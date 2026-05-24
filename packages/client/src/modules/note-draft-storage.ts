import type { NoteLayout } from '~/models/note.model';

export interface NoteSaveDraft {
    title: string;
    content: string;
    createdAt: number;
    baseUpdatedAt: string;
    layout?: NoteLayout;
}

export const getDraftStorageKey = (id: string) => `ocean-brain.note-draft.${id}`;

export const readLocalNoteDraft = (id: string): NoteSaveDraft | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const rawDraft = window.localStorage.getItem(getDraftStorageKey(id));

        if (!rawDraft) {
            return null;
        }

        const draft = JSON.parse(rawDraft) as Partial<NoteSaveDraft>;

        if (
            typeof draft.title !== 'string' ||
            typeof draft.content !== 'string' ||
            typeof draft.baseUpdatedAt !== 'string'
        ) {
            return null;
        }

        return {
            title: draft.title,
            content: draft.content,
            baseUpdatedAt: draft.baseUpdatedAt,
            createdAt: typeof draft.createdAt === 'number' ? draft.createdAt : Date.now(),
            ...(draft.layout === 'narrow' || draft.layout === 'wide' || draft.layout === 'full'
                ? { layout: draft.layout }
                : {}),
        };
    } catch {
        return null;
    }
};

export const writeLocalNoteDraft = (id: string, draft: NoteSaveDraft) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(getDraftStorageKey(id), JSON.stringify(draft));
    } catch {
        // Server save remains the source of truth if local recovery storage is unavailable.
    }
};

export const clearLocalNoteDraft = (id: string) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.removeItem(getDraftStorageKey(id));
    } catch {
        // Ignore storage failures while clearing optional recovery state.
    }
};
