import type { FetchImagesParams } from '~/apis/image.api';
import type { FetchNotesParams, FetchTagNotesParams } from '~/apis/note.api';
import type { FetchPlaceholdersParams } from '~/apis/placeholder.api';
import type { ReminderPaginationParams } from '~/apis/reminder.api';
import type { FetchTagsParams } from '~/apis/tag.api';

const normalizeFields = (fields?: FetchNotesParams['fields']) => {
    if (!fields || fields.length === 0) {
        return null;
    }

    return [...new Set(fields)].sort();
};

const normalizePlaceholderFields = (fields?: FetchPlaceholdersParams['fields']) => {
    if (!fields || fields.length === 0) {
        return null;
    }

    return [...new Set(fields)].sort();
};

export const queryKeys = {
    notes: {
        all: () => ['notes'] as const,
        listAll: () => ['notes', 'list'] as const,
        list: (params: FetchNotesParams = {}) => [
            'notes',
            'list',
            {
                limit: params.limit ?? 25,
                offset: params.offset ?? 0,
                query: params.query ?? '',
                sortBy: params.sortBy ?? null,
                sortOrder: params.sortOrder ?? null,
                pinnedFirst: params.pinnedFirst ?? null,
                fields: normalizeFields(params.fields)
            }
        ] as const,
        tagListAll: () => ['notes', 'tag-list'] as const,
        tagList: (params: FetchTagNotesParams = {}) => [
            'notes',
            'tag-list',
            {
                limit: params.limit ?? 25,
                offset: params.offset ?? 0,
                query: params.query ?? ''
            }
        ] as const,
        detail: (id: string) => ['notes', 'detail', { id }] as const,
        pinned: () => ['notes', 'pinned'] as const,
        backReferences: (noteId: string) => ['notes', 'back-references', { noteId }] as const,
        graph: () => ['notes', 'graph'] as const
    },
    tags: {
        all: () => ['tags'] as const,
        list: (params: FetchTagsParams = {}) => [
            'tags',
            'list',
            {
                limit: params.limit ?? 50,
                offset: params.offset ?? 0,
                query: params.query ?? ''
            }
        ] as const
    },
    images: {
        all: () => ['images'] as const,
        listAll: () => ['images', 'list'] as const,
        list: (params: FetchImagesParams = {}) => [
            'images',
            'list',
            {
                limit: params.limit ?? 50,
                offset: params.offset ?? 0
            }
        ] as const,
        detail: (id: string) => ['images', 'detail', { id }] as const,
        notes: (id: string) => ['images', 'notes', { id }] as const
    },
    reminders: {
        all: () => ['reminders'] as const,
        note: (noteId: string, params: ReminderPaginationParams = {}) => [
            'reminders',
            'note',
            noteId,
            {
                limit: params.limit ?? 10,
                offset: params.offset ?? 0
            }
        ] as const,
        noteAllPages: (noteId: string) => ['reminders', 'note', noteId] as const,
        upcoming: (params: ReminderPaginationParams = {}) => [
            'reminders',
            'upcoming',
            {
                limit: params.limit ?? 10,
                offset: params.offset ?? 0
            }
        ] as const,
        upcomingAllPages: () => ['reminders', 'upcoming'] as const,
        inDateRangeAll: () => ['reminders', 'in-date-range'] as const,
        inDateRange: (year: number, month: number) => ['reminders', 'in-date-range', {
            year,
            month
        }] as const
    },
    placeholders: {
        all: () => ['placeholders'] as const,
        listAll: () => ['placeholders', 'list'] as const,
        list: (params: FetchPlaceholdersParams = {}) => [
            'placeholders',
            'list',
            {
                limit: params.limit ?? 25,
                offset: params.offset ?? 0,
                query: params.query ?? '',
                fields: normalizePlaceholderFields(params.fields)
            }
        ] as const
    },
    calendar: {
        notesInDateRange: (year: number, month: number) => ['calendar', 'notes-in-date-range', {
            year,
            month
        }] as const
    },
    ui: { heroBanner: () => ['ui', 'hero-banner'] as const }
} as const;

export const getPinnedNoteQueryKey = () => queryKeys.notes.pinned();
export const getBackReferencesQueryKey = (noteId: string) => queryKeys.notes.backReferences(noteId);
