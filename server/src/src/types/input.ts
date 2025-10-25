export interface Pagination {
    limit: number;
    offset: number;
}

export interface SearchFilter {
    query: string;
    sortBy?: string;
    sortOrder?: string;
}

export interface NoteInput {
    title: string;
    content: string;
}
