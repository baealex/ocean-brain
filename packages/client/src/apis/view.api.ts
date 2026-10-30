import type { Note } from '~/models/note.model';
import type {
    View,
    ViewDisplayOptions,
    ViewDisplayType,
    ViewNoteCreationContext,
    ViewPropertyFilter,
    ViewSortBy,
    ViewSortOrder,
    ViewsWorkspace,
} from '~/models/view.model';
import { graphQuery } from '~/modules/graph-query';

export interface ViewInput {
    defaultTemplateNoteId?: string | null;
    title?: string;
    displayType?: ViewDisplayType;
    displayOptions?: ViewDisplayOptions;
    tagNames?: string[];
    mode?: 'and' | 'or';
    propertyFilters?: Array<Pick<ViewPropertyFilter, 'key' | 'valueType' | 'operator' | 'value'>>;
    sortBy?: ViewSortBy;
    sortOrder?: ViewSortOrder;
    limit?: number;
}

const VIEW_FIELDS = `
    workspaceId
    defaultTemplateNoteId
    id
    groupId
    title
    displayType
    displayOptions {
        tableColumns
        tablePropertyKeys
        boardGroupByPropertyKey
        calendarDateField
        calendarDatePropertyKey
    }
    tagNames
    mode
    propertyFilters {
        key
        name
        valueType
        operator
        value
    }
    sortBy
    sortOrder
    limit
    order
`;

export const fetchViewNoteCreationContext = (viewId: string, groupValue?: string | null) =>
    graphQuery<{ viewNoteCreationContext: ViewNoteCreationContext }>(
        `query ViewNoteCreationContext($viewId: ID!, $groupValue: String) {
            viewNoteCreationContext(viewId: $viewId, groupValue: $groupValue) {
                workspaceId viewId title tagNames mode defaultTagNames
                templateNote { id title }
                properties {
                    key name valueType defaultValue required
                    options { id label value color order }
                    filters { key name valueType operator value }
                }
            }
        }`,
        { viewId, ...(groupValue !== undefined ? { groupValue } : {}) },
    );

export interface ViewNoteInput {
    deletePropertyKeys?: string[];
    title: string;
    tagNames: string[];
    properties?: { key: string; value: string }[];
}

export const createNoteInView = (viewId: string, input: ViewNoteInput, groupValue?: string | null) =>
    graphQuery<{ createNoteInView: Pick<Note, 'id' | 'title'> }>(
        `mutation CreateNoteInView($viewId: ID!, $input: ViewNoteInput!, $groupValue: String) {
        createNoteInView(viewId: $viewId, input: $input, groupValue: $groupValue) { id title }
    }`,
        { viewId, input, ...(groupValue !== undefined ? { groupValue } : {}) },
    );

export function fetchViewWorkspace(workspaceId?: string) {
    return graphQuery<{
        viewWorkspace: ViewsWorkspace;
    }>(
        `query FetchViewWorkspace($workspaceId: ID) {
        viewWorkspace(workspaceId: $workspaceId) {
            activeGroupId
            groups {
                workspaceId
                id
                title
                order
                views {
                    ${VIEW_FIELDS}
                }
            }
        }
    }`,
        workspaceId ? { workspaceId } : undefined,
    );
}

export function fetchView(id: string) {
    return graphQuery<
        {
            view: View | null;
        },
        { id: string }
    >(
        `query FetchView($id: ID!) {
            view(id: $id) {
                ${VIEW_FIELDS}
            }
        }`,
        { id },
    );
}

export function fetchViewNotes(
    id: string,
    {
        limit = 25,
        offset = 0,
        sortBy,
        sortOrder,
    }: {
        limit?: number;
        offset?: number;
        sortBy?: ViewSortBy;
        sortOrder?: ViewSortOrder;
    } = {},
) {
    return graphQuery<
        {
            viewNotes: {
                totalCount: number;
                notes: Note[];
            };
        },
        {
            id: string;
            pagination: { limit: number; offset: number };
            sortBy?: ViewSortBy;
            sortOrder?: ViewSortOrder;
        }
    >(
        `query FetchViewNotes(
            $id: ID!
            $pagination: PaginationInput
            $sortBy: ViewSortBy
            $sortOrder: ViewSortOrder
        ) {
            viewNotes(id: $id, pagination: $pagination, sortBy: $sortBy, sortOrder: $sortOrder) {
                totalCount
                notes {
                    id
                    title
                    pinned
                    tags {
                        id
                        name
                    }
                    createdAt
                    updatedAt
                    properties {
                        key
                        name
                        value
                        valueType
                        option { id label value color order }
                        createdAt
                        updatedAt
                    }
                }
            }
        }`,
        {
            id,
            pagination: {
                limit,
                offset,
            },
            sortBy,
            sortOrder,
        },
    );
}

export interface ViewCalendarNote extends Pick<Note, 'id' | 'title'> {
    calendarDate: string;
}

export interface ViewCalendarDateRange {
    start: string;
    end: string;
}

export function fetchViewCalendarNotes(id: string, dateRange: ViewCalendarDateRange) {
    return graphQuery<
        {
            viewCalendarNotes: ViewCalendarNote[];
        },
        {
            id: string;
            dateRange: ViewCalendarDateRange;
        }
    >(
        `query FetchViewCalendarNotes($id: ID!, $dateRange: DateRangeInput!) {
            viewCalendarNotes(id: $id, dateRange: $dateRange) {
                id
                title
                calendarDate
            }
        }`,
        { id, dateRange },
    );
}

export type ViewBoardNote = Pick<Note, 'id' | 'title' | 'updatedAt'>;

export interface ViewBoardColumnResult {
    totalCount: number;
    notes: ViewBoardNote[];
}

export interface FetchViewBoardColumnParams {
    optionValue: string | null;
    limit?: number;
    offset?: number;
}

export function fetchViewBoardColumn(id: string, { optionValue, limit = 5, offset = 0 }: FetchViewBoardColumnParams) {
    return graphQuery<
        {
            viewBoardColumn: ViewBoardColumnResult;
        },
        {
            id: string;
            optionValue: string | null;
            pagination: { limit: number; offset: number };
        }
    >(
        `query FetchViewBoardColumn($id: ID!, $optionValue: String, $pagination: PaginationInput) {
            viewBoardColumn(id: $id, optionValue: $optionValue, pagination: $pagination) {
                totalCount
                notes {
                    id
                    title
                    updatedAt
                }
            }
        }`,
        {
            id,
            optionValue,
            pagination: { limit, offset },
        },
    );
}

export function createViewGroup(title: string, workspaceId?: string) {
    return graphQuery<
        {
            createViewGroup: {
                id: string;
            };
        },
        { title: string; workspaceId?: string }
    >(
        `mutation CreateViewGroup($title: String!, $workspaceId: ID) {
            createViewGroup(title: $title, workspaceId: $workspaceId) {
                id
            }
        }`,
        { title, ...(workspaceId ? { workspaceId } : {}) },
    );
}

export function updateViewGroup(id: string, title: string) {
    return graphQuery<
        {
            updateViewGroup: {
                id: string;
            };
        },
        { id: string; title: string }
    >(
        `mutation UpdateViewGroup($id: ID!, $title: String!) {
            updateViewGroup(id: $id, title: $title) {
                id
            }
        }`,
        { id, title },
    );
}

export function deleteViewGroup(id: string) {
    return graphQuery<
        {
            deleteViewGroup: boolean;
        },
        { id: string }
    >(
        `mutation DeleteViewGroup($id: ID!) {
            deleteViewGroup(id: $id)
        }`,
        { id },
    );
}

export function setActiveViewGroup(id: string) {
    return graphQuery<
        {
            setActiveViewGroup: ViewsWorkspace;
        },
        { id: string }
    >(
        `mutation SetActiveViewGroup($id: ID!) {
            setActiveViewGroup(id: $id) {
                activeGroupId
                groups {
                    workspaceId
                    id
                    title
                    order
                    views {
                        ${VIEW_FIELDS}
                    }
                }
            }
        }`,
        { id },
    );
}

export function reorderViewGroups(groupIds: string[], workspaceId?: string) {
    return graphQuery<
        {
            reorderViewGroups: Array<{
                id: string;
            }>;
        },
        { groupIds: string[]; workspaceId?: string }
    >(
        `mutation ReorderViewGroups($groupIds: [ID!]!, $workspaceId: ID) {
            reorderViewGroups(groupIds: $groupIds, workspaceId: $workspaceId) {
                id
            }
        }`,
        { groupIds, ...(workspaceId ? { workspaceId } : {}) },
    );
}

export function createView(groupId: string, input: ViewInput) {
    return graphQuery<
        {
            createView: {
                id: string;
            };
        },
        { groupId: string; input: ViewInput }
    >(
        `mutation CreateView($groupId: ID!, $input: ViewInput!) {
            createView(groupId: $groupId, input: $input) {
                id
            }
        }`,
        { groupId, input },
    );
}

export function updateView(id: string, input: ViewInput) {
    return graphQuery<
        {
            updateView: {
                id: string;
            };
        },
        { id: string; input: ViewInput }
    >(
        `mutation UpdateView($id: ID!, $input: ViewInput!) {
            updateView(id: $id, input: $input) {
                id
            }
        }`,
        { id, input },
    );
}

export function deleteView(id: string) {
    return graphQuery<
        {
            deleteView: boolean;
        },
        { id: string }
    >(
        `mutation DeleteView($id: ID!) {
            deleteView(id: $id)
        }`,
        { id },
    );
}

export function reorderViews(groupId: string, viewIds: string[]) {
    return graphQuery<
        {
            reorderViews: Array<{
                id: string;
            }>;
        },
        { groupId: string; viewIds: string[] }
    >(
        `mutation ReorderViews($groupId: ID!, $viewIds: [ID!]!) {
            reorderViews(groupId: $groupId, viewIds: $viewIds) {
                id
            }
        }`,
        { groupId, viewIds },
    );
}
