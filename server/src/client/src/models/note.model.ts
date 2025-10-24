export interface Note {
    id: string;
    title: string;
    content: string;
    pinned: boolean;
    order: number;
    tags: {
        id: string;
        name: string;
    }[];
    createdAt: string;
    updatedAt: string;
}
