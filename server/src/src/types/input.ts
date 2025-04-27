export interface Pagination {
    limit: number;
    offset: number;
}

export interface SearchFilter {
    query: string;
}

export interface NoteInput {
    title: string;
    content: string;
}
