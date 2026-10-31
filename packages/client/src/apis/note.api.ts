import type { Note, NotePropertyOption, NotePropertyValueType } from '~/models/note.model';
import type { PropertyWorkspaceMapping, WorkspaceScope } from '~/models/workspace.model';
import { type GraphQueryResponse, graphQuery } from '~/modules/graph-query';

type NoteAdditionalField = 'content' | 'order' | 'layout' | 'properties';

const NOTE_ADDITIONAL_FIELDS = new Set<NoteAdditionalField>(['content', 'order', 'layout', 'properties']);

const FETCH_NOTES_QUERY = `query FetchNotes(
            $searchFilter: SearchFilterInput,
            $pagination: PaginationInput
            $scope: WorkspaceScopeInput
        ) {
            allNotes(
                searchFilter: $searchFilter,
                pagination: $pagination, scope: $scope
            ) {
                totalCount
                notes {
__NOTE_ADDITIONAL_FIELDS__                    workspaceId
                    id
                    title
                    pinned
                    createdAt
                    updatedAt
                    tags {
                        id
                        name
                    }
                }
            }
        }`;

const buildAdditionalNoteSelection = (fields?: (keyof Note)[]) => {
    if (!fields || fields.length === 0) {
        return '';
    }

    const selectedFields = Array.from(
        new Set(
            fields.filter((field): field is NoteAdditionalField =>
                NOTE_ADDITIONAL_FIELDS.has(field as NoteAdditionalField),
            ),
        ),
    );

    if (selectedFields.length === 0) {
        return '';
    }

    return (
        selectedFields
            .map((field) =>
                field === 'properties'
                    ? '                    properties {\n                        key\n                        name\n                        value\n                        valueType\n                        option { id label value color order }\n                        createdAt\n                        updatedAt\n                    }'
                    : '                    ' + field,
            )
            .join('\n') + '\n'
    );
};

export interface FetchNotesParams {
    scope?: WorkspaceScope;
    limit?: number;
    offset?: number;
    query?: string;
    sortBy?: 'updatedAt' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    pinnedFirst?: boolean;
    fields?: (keyof Note)[];
}

export function fetchNotes({
    limit = 25,
    offset = 0,
    query = '',
    sortBy,
    sortOrder,
    pinnedFirst,
    fields,
    scope,
}: FetchNotesParams = {}) {
    const additionalFieldsSelection = buildAdditionalNoteSelection(fields);
    const graphqlQuery = FETCH_NOTES_QUERY.replace('__NOTE_ADDITIONAL_FIELDS__', additionalFieldsSelection);

    return graphQuery<{
        allNotes: {
            totalCount: number;
            notes: Note[];
        };
    }>(graphqlQuery, {
        ...(scope ? { scope } : {}),
        searchFilter: {
            query,
            sortBy,
            sortOrder,
            pinnedFirst,
        },
        pagination: {
            limit,
            offset,
        },
    });
}

export interface FetchTagNotesParams {
    scope?: WorkspaceScope;
    query?: string;
    limit?: number;
    offset?: number;
}

export function fetchTagNotes({ query = '', limit = 25, offset = 0, scope }: FetchTagNotesParams = {}) {
    return graphQuery<{
        tagNotes: {
            totalCount: number;
            notes: Note[];
        };
    }>(
        `query FetchTagNotes(
            $searchFilter: SearchFilterInput,
            $pagination: PaginationInput
            $scope: WorkspaceScopeInput
        ) {
            tagNotes(
                searchFilter: $searchFilter,
                pagination: $pagination, scope: $scope
            ) {
                totalCount
                notes {
                    workspaceId
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
            ...(scope ? { scope } : {}),
            searchFilter: { query },
            pagination: {
                limit,
                offset,
            },
        },
    );
}

export interface FetchNotesByTagNamesParams {
    scope?: WorkspaceScope;
    tagNames: string[];
    mode?: 'and' | 'or';
    limit?: number;
    offset?: number;
}

export function fetchNotesByTagNames({
    tagNames,
    mode = 'and',
    limit = 25,
    offset = 0,
    scope,
}: FetchNotesByTagNamesParams) {
    return graphQuery<{
        notesByTagNames: {
            totalCount: number;
            notes: Note[];
        };
    }>(
        `query FetchNotesByTagNames(
            $tagNames: [String!]!,
            $mode: TagMatchMode!,
            $pagination: PaginationInput
            $scope: WorkspaceScopeInput
        ) {
            notesByTagNames(
                tagNames: $tagNames,
                mode: $mode,
                pagination: $pagination, scope: $scope
            ) {
                totalCount
                notes {
                    workspaceId
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
            ...(scope ? { scope } : {}),
            tagNames,
            mode,
            pagination: {
                limit,
                offset,
            },
        },
    );
}

export function fetchNote(id: string) {
    return graphQuery<
        {
            note: Pick<
                Note,
                'workspaceId' | 'title' | 'content' | 'pinned' | 'layout' | 'createdAt' | 'updatedAt' | 'properties'
            >;
        },
        { id: string }
    >(
        `query FetchNote($id: ID!) {
            note(id: $id) {
                workspaceId
                title
                pinned
                layout
                content
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
        }`,
        { id },
    );
}

export function fetchBackReferences(id: string) {
    return graphQuery<
        {
            backReferences: Pick<Note, 'id' | 'title'>[];
        },
        { id: string }
    >(
        `query FetchBackReferences($id: ID!) {
            backReferences(id: $id) {
                id
                title
            }
        }`,
        { id },
    );
}

export interface BackReferenceDetail {
    id: string;
    title: string;
    contexts: { blockId: string | null; segments: { text: string; isTarget: boolean }[] }[];
    hasMoreContexts: boolean;
}

export interface BackReferencePage {
    references: BackReferenceDetail[];
    hasMore: boolean;
    nextOffset: number | null;
}

export function fetchBackReferenceDetails({
    id,
    limit = 20,
    offset = 0,
}: {
    id: string;
    limit?: number;
    offset?: number;
}) {
    return graphQuery<{ backReferenceDetails: BackReferencePage }, { id: string; limit: number; offset: number }>(
        `query FetchBackReferenceDetails($id: ID!, $limit: Int, $offset: Int) {
            backReferenceDetails(id: $id, limit: $limit, offset: $offset) {
                references { id title hasMoreContexts contexts { blockId segments { text isTarget } } }
                hasMore nextOffset
            }
        }`,
        { id, limit, offset },
    );
}

export function fetchImageNotes(src: string) {
    return graphQuery<
        {
            imageNotes: Pick<Note, 'id' | 'title' | 'createdAt' | 'updatedAt'>[];
        },
        { src: string }
    >(
        `query FetchImageNotes($src: String!) {
            imageNotes(src: $src) {
                id
                title
                createdAt
                updatedAt
            }
        }`,
        { src },
    );
}

export interface NotePropertyKeySummary {
    workspaceId?: string;
    key: string;
    name: string;
    valueType: NotePropertyValueType;
    noteCount: number;
    options: NotePropertyOption[];
    updatedAt: string;
}

export interface FetchNotePropertyKeysParams {
    scope?: WorkspaceScope;
    query?: string;
    limit?: number;
    offset?: number;
}

export interface NotePropertyKeysResult {
    totalCount: number;
    keys: NotePropertyKeySummary[];
}

const NOTE_PROPERTY_KEYS_PAGE_SIZE = 100;

export function fetchNotePropertyKeys({ query = '', limit = 50, offset = 0, scope }: FetchNotePropertyKeysParams = {}) {
    return graphQuery<
        {
            notePropertyKeys: NotePropertyKeysResult;
        },
        {
            query?: string;
            scope?: WorkspaceScope;
            pagination: {
                limit: number;
                offset: number;
            };
        }
    >(
        `query FetchNotePropertyKeys($query: String, $pagination: PaginationInput, $scope: WorkspaceScopeInput) {
            notePropertyKeys(query: $query, pagination: $pagination, scope: $scope) {
                totalCount
                keys {
                    workspaceId
                    key
                    name
                    valueType
                    noteCount
                    options { id label value color order }
                    updatedAt
                }
            }
        }`,
        {
            ...(scope ? { scope } : {}),
            ...(query ? { query } : {}),
            pagination: {
                limit,
                offset,
            },
        },
    );
}

export async function fetchAllNotePropertyKeys(
    scope?: WorkspaceScope,
): Promise<GraphQueryResponse<{ notePropertyKeys: NotePropertyKeysResult }>> {
    const propertyByKey = new Map<string, NotePropertyKeySummary>();
    let offset = 0;
    let totalCount = 0;

    while (true) {
        const response = await fetchNotePropertyKeys({
            limit: NOTE_PROPERTY_KEYS_PAGE_SIZE,
            offset,
            ...(scope ? { scope } : {}),
        });

        if (response.type === 'error') {
            return response;
        }

        const page = response.notePropertyKeys;
        totalCount = page.totalCount;

        for (const property of page.keys) {
            propertyByKey.set(property.key, property);
        }

        offset += page.keys.length;

        if (page.keys.length === 0 || offset >= totalCount) {
            break;
        }
    }

    return {
        type: 'success',
        notePropertyKeys: {
            totalCount,
            keys: Array.from(propertyByKey.values()),
        },
    };
}

export interface CreateNotePropertyKeyRequestData {
    workspaceId?: string;
    key?: string;
    name?: string;
    valueType: NotePropertyValueType;
    options?: Array<
        Omit<NotePropertyOption, 'id'> | { label: string; value?: string; color?: string | null; order?: number }
    >;
}

export function createNotePropertyKey(input: CreateNotePropertyKeyRequestData) {
    return graphQuery<
        {
            createNotePropertyKey: NotePropertyKeySummary;
        },
        { input: CreateNotePropertyKeyRequestData }
    >(
        `mutation CreateNotePropertyKey($input: NotePropertyDefinitionInput!) {
            createNotePropertyKey(input: $input) {
                key
                name
                valueType
                noteCount
                options { id label value color order }
                updatedAt
            }
        }`,
        { input },
    );
}

export interface UpdateNotePropertyKeyRequestData {
    key: string;
    name?: string;
    options?: Array<
        NotePropertyOption | { id?: string; label: string; value?: string; color?: string | null; order?: number }
    >;
}

export function updateNotePropertyKey({ key, ...input }: UpdateNotePropertyKeyRequestData) {
    return graphQuery<
        {
            updateNotePropertyKey: NotePropertyKeySummary;
        },
        {
            key: string;
            input: Omit<UpdateNotePropertyKeyRequestData, 'key'>;
        }
    >(
        `mutation UpdateNotePropertyKey($key: String!, $input: NotePropertyDefinitionUpdateInput!) {
            updateNotePropertyKey(key: $key, input: $input) {
                key
                name
                valueType
                noteCount
                options { id label value color order }
                updatedAt
            }
        }`,
        { key, input },
    );
}

export interface DeleteNotePropertyKeyRequestData {
    key: string;
    confirmImpact?: boolean;
}

export interface DeleteNotePropertyKeyResult {
    key: string;
    name: string;
    valueType: NotePropertyValueType;
    affectedNoteCount: number;
    deleted: boolean;
}

export function deleteNotePropertyKey({ key, confirmImpact }: DeleteNotePropertyKeyRequestData) {
    return graphQuery<
        {
            deleteNotePropertyKey: DeleteNotePropertyKeyResult;
        },
        DeleteNotePropertyKeyRequestData
    >(
        `mutation DeleteNotePropertyKey($key: String!, $confirmImpact: Boolean) {
            deleteNotePropertyKey(key: $key, confirmImpact: $confirmImpact) {
                key
                name
                valueType
                affectedNoteCount
                deleted
            }
        }`,
        {
            key,
            ...(confirmImpact ? { confirmImpact: true } : {}),
        },
    );
}

export interface CreateNoteRequestData {
    workspaceId?: string;
    title: string;
    content: string;
    layout?: string;
}

export function createNote(note: CreateNoteRequestData) {
    return graphQuery<
        {
            createNote: Pick<Note, 'id' | 'workspaceId' | 'title' | 'createdAt' | 'updatedAt'>;
        },
        { note: CreateNoteRequestData }
    >(
        `mutation CreateNote($note: NoteInput!) {
            createNote(note: $note) {
                workspaceId
                id
                title
                createdAt
                updatedAt
            }
        }`,
        { note },
    );
}

export interface NotePropertySetInput {
    key: string;
    name?: string;
    value: string;
    valueType: NotePropertyValueType;
}

export interface UpdateNotePropertiesRequestData {
    id: string;
    set?: NotePropertySetInput[];
    deleteKeys?: string[];
    editSessionId?: string;
    expectedUpdatedAt: string;
    force?: boolean;
}

export function updateNoteProperties({
    id,
    set = [],
    deleteKeys = [],
    editSessionId,
    expectedUpdatedAt,
    force,
}: UpdateNotePropertiesRequestData) {
    return graphQuery<
        {
            updateNoteProperties: Pick<Note, 'id' | 'updatedAt' | 'properties'>;
        },
        {
            id: string;
            patch: {
                set?: NotePropertySetInput[];
                deleteKeys?: string[];
            };
            editSessionId?: string;
            expectedUpdatedAt: string;
            force?: boolean;
        }
    >(
        `mutation UpdateNoteProperties(
            $id: ID!,
            $patch: NotePropertiesPatchInput!,
            $editSessionId: String,
            $expectedUpdatedAt: String!,
            $force: Boolean
        ) {
            updateNoteProperties(
                id: $id,
                patch: $patch,
                editSessionId: $editSessionId,
                expectedUpdatedAt: $expectedUpdatedAt,
                force: $force
            ) {
                id
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
        }`,
        {
            id,
            patch: {
                ...(set.length > 0 ? { set } : {}),
                ...(deleteKeys.length > 0 ? { deleteKeys } : {}),
            },
            ...(editSessionId ? { editSessionId } : {}),
            expectedUpdatedAt,
            ...(force ? { force: true } : {}),
        },
    );
}

export interface UpdateNoteRequestData {
    id: string;
    title?: string;
    content?: string;
    layout?: string;
    editSessionId?: string;
    expectedUpdatedAt?: string;
    force?: boolean;
}

export interface NoteSnapshotMeta {
    entrypoint?: string;
    label?: string;
}

export interface NoteSnapshot {
    id: string;
    title: string;
    contentPreview: string;
    createdAt: string;
    meta: NoteSnapshotMeta;
}

export interface NoteSnapshotDetail extends NoteSnapshot {
    contentAsMarkdown: string;
}

export interface NoteSnapshotDiffEndpoint {
    kind: 'snapshot' | 'current_note';
    id: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
    meta?: NoteSnapshotMeta | null;
}

export interface NoteSnapshotDiff {
    noteId: string;
    mode: 'snapshot_to_snapshot' | 'snapshot_to_current';
    before: NoteSnapshotDiffEndpoint;
    after: NoteSnapshotDiffEndpoint;
    diff: {
        markdown: string;
        changedLineCount: number;
        changedCharCount: number;
        beforeMarkdownSha256: string;
        afterMarkdownSha256: string;
    };
}

export interface TrashedNote {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
    contentPreview: string;
    pinned: boolean;
    order: number;
    layout: Note['layout'];
    tagNames: string[];
}

export interface TrashedNoteDetail extends TrashedNote {
    contentAsMarkdown: string;
}

export const updateNote = ({ id, editSessionId, expectedUpdatedAt, force, ...note }: UpdateNoteRequestData) => {
    return graphQuery<
        {
            updateNote: Pick<Note, 'id' | 'title' | 'updatedAt'>;
        },
        {
            id: string;
            note: Omit<UpdateNoteRequestData, 'id' | 'editSessionId' | 'expectedUpdatedAt' | 'force'>;
            editSessionId?: string;
            expectedUpdatedAt?: string;
            force?: boolean;
        }
    >(
        `mutation UpdateNote($id: ID!, $note: NoteInput!, $editSessionId: String, $expectedUpdatedAt: String, $force: Boolean) {
            updateNote(id: $id, note: $note, editSessionId: $editSessionId, expectedUpdatedAt: $expectedUpdatedAt, force: $force) {
                id
                title
                updatedAt
            }
        }`,
        {
            id,
            note,
            ...(editSessionId ? { editSessionId } : {}),
            ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
            ...(force ? { force: true } : {}),
        },
    );
};

export function fetchNoteSnapshots(id: string, limit = 10) {
    return graphQuery<
        {
            noteSnapshots: NoteSnapshot[];
        },
        {
            id: string;
            limit: number;
        }
    >(
        `query FetchNoteSnapshots($id: ID!, $limit: Int) {
            noteSnapshots(id: $id, limit: $limit) {
                id
                title
                contentPreview
                createdAt
                meta {
                    entrypoint
                    label
                }
            }
        }`,
        {
            id,
            limit,
        },
    );
}

export function fetchNoteSnapshot(id: string) {
    return graphQuery<
        {
            noteSnapshot: NoteSnapshotDetail | null;
        },
        { id: string }
    >(
        `query FetchNoteSnapshot($id: ID!) {
            noteSnapshot(id: $id) {
                id
                title
                contentPreview
                contentAsMarkdown
                createdAt
                meta {
                    entrypoint
                    label
                }
            }
        }`,
        { id },
    );
}

export function fetchNoteSnapshotDiff(id: string, target: 'next' | 'previous' | 'current' = 'current') {
    return graphQuery<
        {
            noteSnapshotDiff: NoteSnapshotDiff | null;
        },
        { id: string; target: 'NEXT' | 'PREVIOUS' | 'CURRENT'; contextLines: number }
    >(
        `query FetchNoteSnapshotDiff($id: ID!, $target: NoteSnapshotDiffTarget, $contextLines: Int) {
            noteSnapshotDiff(id: $id, target: $target, contextLines: $contextLines) {
                noteId
                mode
                before {
                    kind
                    id
                    title
                    createdAt
                    updatedAt
                    meta {
                        entrypoint
                        label
                    }
                }
                after {
                    kind
                    id
                    title
                    createdAt
                    updatedAt
                    meta {
                        entrypoint
                        label
                    }
                }
                diff {
                    markdown
                    changedLineCount
                    changedCharCount
                    beforeMarkdownSha256
                    afterMarkdownSha256
                }
            }
        }`,
        { id, target: target.toUpperCase() as 'NEXT' | 'PREVIOUS' | 'CURRENT', contextLines: 3 },
    );
}

export function restoreNoteSnapshot(id: string, expectedUpdatedAt: string, mappings?: PropertyWorkspaceMapping[]) {
    return graphQuery<
        {
            restoreNoteSnapshot: Pick<Note, 'id' | 'title' | 'updatedAt' | 'layout' | 'pinned' | 'content'>;
        },
        { id: string; expectedUpdatedAt: string; mappings?: PropertyWorkspaceMapping[] }
    >(
        `mutation RestoreNoteSnapshot($id: ID!, $expectedUpdatedAt: String!, $mappings: [PropertyWorkspaceMappingInput!]) {
            restoreNoteSnapshot(id: $id, expectedUpdatedAt: $expectedUpdatedAt, mappings: $mappings) {
                id
                title
                pinned
                layout
                content
                updatedAt
            }
        }`,
        { id, expectedUpdatedAt, ...(mappings ? { mappings } : {}) },
    );
}

export function fetchTrashedNotes({
    limit = 25,
    offset = 0,
    scope,
}: Pick<FetchNotesParams, 'limit' | 'offset' | 'scope'> = {}) {
    return graphQuery<
        {
            trashedNotes: {
                totalCount: number;
                notes: TrashedNote[];
            };
        },
        {
            scope?: WorkspaceScope;
            pagination: {
                limit: number;
                offset: number;
            };
        }
    >(
        `query FetchTrashedNotes($pagination: PaginationInput, $scope: WorkspaceScopeInput) {
            trashedNotes(pagination: $pagination, scope: $scope) {
                totalCount
                notes {
                    workspaceId
                    id
                    title
                    createdAt
                    updatedAt
                    deletedAt
                    contentPreview
                    pinned
                    order
                    layout
                    tagNames
                }
            }
        }`,
        {
            ...(scope ? { scope } : {}),
            pagination: {
                limit,
                offset,
            },
        },
    );
}

export function fetchTrashedNote(id: string) {
    return graphQuery<
        {
            trashedNote: TrashedNoteDetail | null;
        },
        { id: string }
    >(
        `query FetchTrashedNote($id: ID!) {
            trashedNote(id: $id) {
                id
                title
                createdAt
                updatedAt
                deletedAt
                contentPreview
                contentAsMarkdown
                pinned
                order
                layout
                tagNames
            }
        }`,
        { id },
    );
}

export function restoreTrashedNote(id: string) {
    return graphQuery<
        {
            restoreTrashedNote: Pick<Note, 'id' | 'title' | 'updatedAt' | 'layout' | 'pinned' | 'content'>;
        },
        { id: string }
    >(
        `mutation RestoreTrashedNote($id: ID!) {
            restoreTrashedNote(id: $id) {
                id
                title
                pinned
                layout
                content
                updatedAt
            }
        }`,
        { id },
    );
}

export function purgeTrashedNote(id: string) {
    return graphQuery<
        {
            purgeTrashedNote: boolean;
        },
        { id: string }
    >(
        `mutation PurgeTrashedNote($id: ID!) {
            purgeTrashedNote(id: $id)
        }`,
        { id },
    );
}

export function pinNote(id: string, pinned: boolean) {
    return graphQuery<
        {
            pinNote: Pick<Note, 'id' | 'title' | 'pinned' | 'createdAt' | 'updatedAt'>;
        },
        { id: string; pinned: boolean }
    >(
        `mutation PinNote($id: ID!, $pinned: Boolean!) {
            pinNote(id: $id, pinned: $pinned) {
                id
                title
                pinned
                createdAt
                updatedAt
            }
        }`,
        {
            id,
            pinned,
        },
    );
}

export function deleteNote(id: string) {
    return graphQuery<
        {
            deleteNote: boolean;
        },
        { id: string }
    >(
        `mutation DeleteNote($id: ID!) {
            deleteNote(id: $id)
        }`,
        { id },
    );
}

export interface NoteOrderInput {
    id: string;
    order: number;
}

export function reorderNotes(notes: NoteOrderInput[]) {
    return graphQuery<
        {
            reorderNotes: Pick<Note, 'id' | 'order'>[];
        },
        { notes: NoteOrderInput[] }
    >(
        `mutation ReorderNotes($notes: [NoteOrderInput!]!) {
            reorderNotes(notes: $notes) {
                id
                order
            }
        }`,
        { notes },
    );
}

export interface GraphNode {
    id: string;
    title: string;
    connections: number;
    updatedAt: string;
    tags: Array<{
        id: string;
        name: string;
    }>;
}

export interface GraphLink {
    source: string;
    target: string;
}

export interface NoteGraph {
    nodes: GraphNode[];
    links: GraphLink[];
}

export function fetchNoteGraph(scope?: WorkspaceScope) {
    return graphQuery<{
        noteGraph: NoteGraph;
    }>(
        `query FetchNoteGraph($scope: WorkspaceScopeInput) {
            noteGraph(scope: $scope) {
                nodes {
                    id
                    title
                    connections
                    updatedAt
                    tags {
                        id
                        name
                    }
                }
                links {
                    source
                    target
                }
            }
        }`,
        scope ? { scope } : undefined,
    );
}

export const fetchPinnedNotes = (scope?: WorkspaceScope) =>
    graphQuery<{ pinnedNotes: Pick<Note, 'id' | 'title' | 'order'>[] }>(
        `
    query FetchPinnedNotes($scope: WorkspaceScopeInput) { pinnedNotes(scope: $scope) { id title order } }
`,
        scope ? { scope } : undefined,
    );

export const fetchNotesInDateRange = (dateRange: { start: string; end: string }, scope?: WorkspaceScope) =>
    graphQuery<{ notesInDateRange: Note[] }>(
        `
    query NotesInDateRange($dateRange: DateRangeInput!, $scope: WorkspaceScopeInput) {
        notesInDateRange(dateRange: $dateRange, scope: $scope) { id workspaceId title createdAt updatedAt tags { id name } }
    }
`,
        { dateRange, ...(scope ? { scope } : {}) },
    );
