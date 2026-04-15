import type { Note } from '~/models/note.model';
import type { ViewSection, ViewsWorkspace } from '~/models/view.model';
import { graphQuery } from '~/modules/graph-query';

export interface ViewSectionInput {
    title?: string;
    tagNames: string[];
    mode?: 'and' | 'or';
    limit?: number;
}

export function fetchViewWorkspace() {
    return graphQuery<{
        viewWorkspace: ViewsWorkspace;
    }>(`query FetchViewWorkspace {
        viewWorkspace {
            activeTabId
            tabs {
                id
                title
                order
                sections {
                    id
                    tabId
                    title
                    tagNames
                    mode
                    limit
                    order
                }
            }
        }
    }`);
}

export function fetchViewSection(id: string) {
    return graphQuery<
        {
            viewSection: ViewSection | null;
        },
        { id: string }
    >(
        `query FetchViewSection($id: ID!) {
            viewSection(id: $id) {
                id
                tabId
                title
                tagNames
                mode
                limit
                order
            }
        }`,
        { id },
    );
}

export function fetchViewSectionNotes(
    id: string,
    { limit = 25, offset = 0 }: { limit?: number; offset?: number } = {},
) {
    return graphQuery<
        {
            viewSectionNotes: {
                totalCount: number;
                notes: Note[];
            };
        },
        { id: string; pagination: { limit: number; offset: number } }
    >(
        `query FetchViewSectionNotes($id: ID!, $pagination: PaginationInput) {
            viewSectionNotes(id: $id, pagination: $pagination) {
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
                }
            }
        }`,
        {
            id,
            pagination: {
                limit,
                offset,
            },
        },
    );
}

export function createViewTab(title: string) {
    return graphQuery<
        {
            createViewTab: {
                id: string;
            };
        },
        { title: string }
    >(
        `mutation CreateViewTab($title: String!) {
            createViewTab(title: $title) {
                id
            }
        }`,
        { title },
    );
}

export function updateViewTab(id: string, title: string) {
    return graphQuery<
        {
            updateViewTab: {
                id: string;
            };
        },
        { id: string; title: string }
    >(
        `mutation UpdateViewTab($id: ID!, $title: String!) {
            updateViewTab(id: $id, title: $title) {
                id
            }
        }`,
        { id, title },
    );
}

export function deleteViewTab(id: string) {
    return graphQuery<
        {
            deleteViewTab: boolean;
        },
        { id: string }
    >(
        `mutation DeleteViewTab($id: ID!) {
            deleteViewTab(id: $id)
        }`,
        { id },
    );
}

export function setActiveViewTab(id: string) {
    return graphQuery<
        {
            setActiveViewTab: ViewsWorkspace;
        },
        { id: string }
    >(
        `mutation SetActiveViewTab($id: ID!) {
            setActiveViewTab(id: $id) {
                activeTabId
                tabs {
                    id
                    title
                    order
                    sections {
                        id
                        tabId
                        title
                        tagNames
                        mode
                        limit
                        order
                    }
                }
            }
        }`,
        { id },
    );
}

export function reorderViewTabs(tabIds: string[]) {
    return graphQuery<
        {
            reorderViewTabs: Array<{
                id: string;
            }>;
        },
        { tabIds: string[] }
    >(
        `mutation ReorderViewTabs($tabIds: [ID!]!) {
            reorderViewTabs(tabIds: $tabIds) {
                id
            }
        }`,
        { tabIds },
    );
}

export function createViewSection(tabId: string, input: ViewSectionInput) {
    return graphQuery<
        {
            createViewSection: {
                id: string;
            };
        },
        { tabId: string; input: ViewSectionInput }
    >(
        `mutation CreateViewSection($tabId: ID!, $input: ViewSectionInput!) {
            createViewSection(tabId: $tabId, input: $input) {
                id
            }
        }`,
        { tabId, input },
    );
}

export function updateViewSection(id: string, input: ViewSectionInput) {
    return graphQuery<
        {
            updateViewSection: {
                id: string;
            };
        },
        { id: string; input: ViewSectionInput }
    >(
        `mutation UpdateViewSection($id: ID!, $input: ViewSectionInput!) {
            updateViewSection(id: $id, input: $input) {
                id
            }
        }`,
        { id, input },
    );
}

export function deleteViewSection(id: string) {
    return graphQuery<
        {
            deleteViewSection: boolean;
        },
        { id: string }
    >(
        `mutation DeleteViewSection($id: ID!) {
            deleteViewSection(id: $id)
        }`,
        { id },
    );
}

export function reorderViewSections(tabId: string, sectionIds: string[]) {
    return graphQuery<
        {
            reorderViewSections: Array<{
                id: string;
            }>;
        },
        { tabId: string; sectionIds: string[] }
    >(
        `mutation ReorderViewSections($tabId: ID!, $sectionIds: [ID!]!) {
            reorderViewSections(tabId: $tabId, sectionIds: $sectionIds) {
                id
            }
        }`,
        { tabId, sectionIds },
    );
}
