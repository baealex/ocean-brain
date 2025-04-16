import type { Note } from '~/models/Note';
import { graphQuery } from '~/modules/graph-query';

export interface FetchNotesParams {
    limit?: number;
    offset?: number;
    query?: string;
    fields?: Partial<keyof Note>[];
}

export function fetchNotes({
    limit = 25,
    offset = 0,
    query = '',
    fields
}: FetchNotesParams = {}) {
    return graphQuery<{
        allNotes: {
            totalCount: number;
            notes: Note[];
        };
    }>(
        `query def(
            $searchFilter: SearchFilterInput,
            $pagination: PaginationInput
        ) {
            allNotes(
                searchFilter: $searchFilter,
                pagination: $pagination
            ) {
                totalCount
                notes {
                    ${fields ? fields.join('\n') : ''}
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
        }`,
        {
            searchFilter: { query },
            pagination: {
                limit,
                offset
            }
        }
    );
}

export function fetchTagNotes({
    query = '',
    limit = 25,
    offset = 0
}) {
    return graphQuery<{
        tagNotes: {
            totalCount: number;
            notes: Note[];
        };
    }>(
        `query def(
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
                offset
            }
        }
    );
}

export function fetchImageNotes(src: string) {
    return graphQuery<{
        imageNotes: Pick<Note, 'id' | 'title' | 'createdAt' | 'updatedAt'>[];
    }>(
        `query {
            imageNotes(src: "${src}") {
                id
                title
                createdAt
                updatedAt
            }
        }`,
    );
}

interface CreateNoteRequestData {
    title: string;
    content: string;
}

export function createNote(note: CreateNoteRequestData) {
    return graphQuery<{
        createNote: Pick<Note, 'id'>;
    }>(
        `mutation def($note: NoteInput!) {
            createNote(note: $note) {
                id
            }
        }`,
        { note }
    );
}

interface UpdateNoteRequestData {
    id: string;
    title: string;
    content: string;
}

export const updateNote = ({ id, ...note }: UpdateNoteRequestData) => {
    return graphQuery<{
        updateNote: Pick<Note, 'id' | 'title'>;
    }>(
        `mutation def($note: NoteInput!) {
            updateNote(id: "${id}", note: $note) {
                id
                title
            }
        }`,
        { note }
    );
};

export function pinNote(id: string, pinned: boolean) {
    return graphQuery<{
        updateNotePinned: Pick<Note, 'id' | 'title' | 'pinned' | 'createdAt' | 'updatedAt'>;
    }>(
        `mutation {
            pinNote(id: "${id}", pinned: ${pinned}) {
                id
                title
                pinned
                createdAt
                updatedAt
            }
        }`,
    );
}

export function deleteNote(id: string) {
    return graphQuery<{
        deleteNote: boolean;
    }>(
        `mutation {
            deleteNote(id: "${id}")
        }`,
    );
}
