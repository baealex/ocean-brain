import type { NoteLayout } from '~/models.js';

export interface Pagination {
    limit: number;
    offset: number;
}

export interface SearchFilter {
    query: string;
    sortBy?: string;
    sortOrder?: string;
    pinnedFirst?: boolean;
}

export interface NoteInput {
    title: string;
    content: string;
    layout?: NoteLayout;
}
