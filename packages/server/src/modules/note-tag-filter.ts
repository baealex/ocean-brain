import type { Prisma } from '~/models.js';

export type NoteTagMatchMode = 'and' | 'or';

export const normalizeNoteTagNames = (tagNames: string[]) => {
    return Array.from(new Set(tagNames.map((tagName) => tagName.trim()).filter(Boolean)));
};

export const buildNoteTagNamesWhere = (tagNames: string[], mode: NoteTagMatchMode): Prisma.NoteWhereInput => {
    const normalizedTagNames = normalizeNoteTagNames(tagNames);

    if (normalizedTagNames.length === 0) {
        return { id: -1 };
    }

    if (mode === 'or') {
        return { tags: { some: { name: { in: normalizedTagNames } } } };
    }

    return { AND: normalizedTagNames.map((tagName) => ({ tags: { some: { name: tagName } } })) };
};
