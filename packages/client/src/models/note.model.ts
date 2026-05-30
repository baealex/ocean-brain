export type NoteLayout = 'narrow' | 'wide' | 'full';
export type NotePropertyValueType = 'text' | 'number' | 'date' | 'boolean' | 'select';

export interface NotePropertyOption {
    id: string;
    label: string;
    value: string;
    color?: string | null;
    order: number;
}

export interface NoteProperty {
    key: string;
    name: string;
    value: string;
    valueType: NotePropertyValueType;
    option?: NotePropertyOption | null;
    createdAt: string;
    updatedAt: string;
}

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
    properties?: NoteProperty[];
    createdAt: string;
    updatedAt: string;
}
