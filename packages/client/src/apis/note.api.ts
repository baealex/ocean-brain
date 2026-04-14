import type { Note } from '~/models/note.model';
import { graphQuery } from '~/modules/graph-query';

type NoteAdditionalField = 'content' | 'order' | 'layout';

const NOTE_ADDITIONAL_FIELDS = new Set<NoteAdditionalField>(['content', 'order', 'layout']);

const FETCH_NOTES_QUERY = `query FetchNotes(
            $searchFilter: SearchFilterInput,
            $pagination: PaginationInput
        ) {
            allNotes(
                searchFilter: $searchFilter,
                pagination: $pagination
            ) {
                totalCount
                notes {
__NOTE_ADDITIONAL_FIELDS__                    id
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

    return selectedFields.map((field) => '                    ' + field).join('\n') + '\n';
};

export interface FetchNotesParams {
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
}: FetchNotesParams = {}) {
    const additionalFieldsSelection = buildAdditionalNoteSelection(fields);
    const graphqlQuery = FETCH_NOTES_QUERY.replace('__NOTE_ADDITIONAL_FIELDS__', additionalFieldsSelection);

    return graphQuery<{
        allNotes: {
            totalCount: number;
            notes: Note[];
        };
    }>(graphqlQuery, {
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
    query?: string;
    limit?: number;
    offset?: number;
}

export function fetchTagNotes({ query = '', limit = 25, offset = 0 }: FetchTagNotesParams = {}) {
    return graphQuery<{
        tagNotes: {
            totalCount: number;
            notes: Note[];
        };
    }>(
        `query FetchTagNotes(
            $searchFilter: SearchFilterInput,
            $pagination: PaginationInput
        ) {
            tagNotes(
                searchFilter: $searchFilter,
                pagination: $pagination
            ) {
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
            searchFilter: { query },
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
            note: Pick<Note, 'title' | 'content' | 'pinned' | 'layout' | 'updatedAt'>;
        },
        { id: string }
    >(
        `query FetchNote($id: ID!) {
            note(id: $id) {
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

export interface CreateNoteRequestData {
    title: string;
    content: string;
    layout?: string;
}

export function createNote(note: CreateNoteRequestData) {
    return graphQuery<
        {
            createNote: Pick<Note, 'id'>;
        },
        { note: CreateNoteRequestData }
    >(
        `mutation CreateNote($note: NoteInput!) {
            createNote(note: $note) {
                id
            }
        }`,
        { note },
    );
}

export interface UpdateNoteRequestData {
    id: string;
    title?: string;
    content?: string;
    layout?: string;
    editSessionId?: string;
}

export interface NoteSnapshotMeta {
    entrypoint?: string;
    label?: string;
}

export interface NoteSnapshot {
    id: string;
    title: string;
    createdAt: string;
    meta: NoteSnapshotMeta;
}

export interface TrashedNote {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
    pinned: boolean;
    order: number;
    layout: Note['layout'];
    tagNames: string[];
}

export const updateNote = ({ id, editSessionId, ...note }: UpdateNoteRequestData) => {
    return graphQuery<
        {
            updateNote: Pick<Note, 'id' | 'title'>;
        },
        {
            id: string;
            note: Omit<UpdateNoteRequestData, 'id' | 'editSessionId'>;
            editSessionId?: string;
        }
    >(
        `mutation UpdateNote($id: ID!, $note: NoteInput!, $editSessionId: String) {
            updateNote(id: $id, note: $note, editSessionId: $editSessionId) {
                id
                title
            }
        }`,
        {
            id,
            note,
            ...(editSessionId ? { editSessionId } : {}),
        },
    );
};

export function fetchNoteSnapshots(id: string, limit = 5) {
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

export function restoreNoteSnapshot(id: string) {
    return graphQuery<
        {
            restoreNoteSnapshot: Pick<Note, 'id' | 'title' | 'updatedAt' | 'layout' | 'pinned' | 'content'>;
        },
        { id: string }
    >(
        `mutation RestoreNoteSnapshot($id: ID!) {
            restoreNoteSnapshot(id: $id) {
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

export function fetchTrashedNotes({ limit = 25, offset = 0 }: Pick<FetchNotesParams, 'limit' | 'offset'> = {}) {
    return graphQuery<
        {
            trashedNotes: {
                totalCount: number;
                notes: TrashedNote[];
            };
        },
        {
            pagination: {
                limit: number;
                offset: number;
            };
        }
    >(
        `query FetchTrashedNotes($pagination: PaginationInput) {
            trashedNotes(pagination: $pagination) {
                totalCount
                notes {
                    id
                    title
                    createdAt
                    updatedAt
                    deletedAt
                    pinned
                    order
                    layout
                    tagNames
                }
            }
        }`,
        {
            pagination: {
                limit,
                offset,
            },
        },
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
}

export interface GraphLink {
    source: string;
    target: string;
}

export interface NoteGraph {
    nodes: GraphNode[];
    links: GraphLink[];
}

export function fetchNoteGraph() {
    return graphQuery<{
        noteGraph: NoteGraph;
    }>(
        `query FetchNoteGraph {
            noteGraph {
                nodes {
                    id
                    title
                    connections
                }
                links {
                    source
                    target
                }
            }
        }`,
    );
}
