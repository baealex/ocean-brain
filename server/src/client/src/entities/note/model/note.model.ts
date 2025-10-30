export type NoteLayout = 'narrow' | 'wide' | 'full';

export interface Note {
    id: string;
    title: string;
    content: string;
    pinned: boolean;
    order: number;
    layout: NoteLayout;
    tags: {
        id: string;
        name: string;
    }[];
    createdAt: string;
    updatedAt: string;
}
