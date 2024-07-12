import type { Note } from '~/models/Note';
import { graphQuery } from '~/modules/graph-query';

export function fetchNotes({
    limit = 25,
    offset = 0,
    query = ''
} = {}) {
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
    ).then(data => data.allNotes);
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
    ).then(data => data.tagNotes);
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
    ).then(data => data.imageNotes);
}

export function createNote({
    title = '',
    content = ''
} = {}) {
    return graphQuery<{
        createNote: Pick<Note, 'id'>;
    }>(
        `mutation {
            createNote(title: "${title}", content: "${content}") {
                id
            }
        }`,
    ).then(data => data.createNote);
}

export function pinNote(id: string, pinned: boolean) {
    graphQuery<{
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
    ).then(data => data.updateNotePinned);
}

export function deleteNote(id: string) {
    graphQuery<{
        deleteNote: boolean;
    }>(
        `mutation {
            deleteNote(id: "${id}")
        }`,
    ).then(data => data.deleteNote);
}
