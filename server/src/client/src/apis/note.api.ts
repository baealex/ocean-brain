import type { Note } from '~/models/Note';
import { graphQuery } from '~/modules/graph-query';

export function fetchNotes({
    limit = 999,
    offset = 0,
    query = '',
    extend = ''
} = {}) {
    return graphQuery<{
        allNotes: Note[];
    }>(
        `query {
            allNotes(query: "${query}", limit: ${limit}, offset: ${offset}) {
                id
                title
                pinned
                createdAt
                updatedAt
                ${extend}
            }
        }`
    ).then(data => data.allNotes);
}

export function fetchTotalNotes() {
    return graphQuery<{
        totalNotes: number;
    }>(
        `query {
            totalNotes
        }`
    ).then(data => data.totalNotes);
}

export function fetchTagNotes(id: string) {
    return graphQuery<{
        tagNotes: Note[];
    }>(
        `query {
            tagNotes(id: ${id}) {
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
        }`,
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
