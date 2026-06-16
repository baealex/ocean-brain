import type { Note, NotePropertyOption, NotePropertyValueType } from '~/models/note.model';
import type { Placeholder } from '~/models/placeholder.model';
import type { Reminder } from '~/models/reminder.model';
import type { ViewsWorkspace } from '~/models/view.model';
import type { GraphQueryResponse } from '../graph-query-types';

export interface LocalTag {
    id: string;
    name: string;
}

export interface LocalImage {
    id: string;
    url: string;
}

export interface LocalTrashNote extends Note {
    deletedAt: string;
}

export interface LocalPropertyDefinition {
    key: string;
    name: string;
    valueType: NotePropertyValueType;
    options: NotePropertyOption[];
    updatedAt: string;
}

export interface LocalDemoState {
    version: 5;
    notes: Note[];
    trashedNotes: LocalTrashNote[];
    tags: LocalTag[];
    reminders: Reminder[];
    placeholders: Placeholder[];
    images: LocalImage[];
    cache: Record<string, string>;
    viewWorkspace: ViewsWorkspace;
    propertyDefinitions: LocalPropertyDefinition[];
    mcp: {
        enabled: boolean;
        hasActiveToken: boolean;
        token: null | {
            id: string;
            createdAt: string;
            lastUsedAt: string | null;
        };
    };
}

export type LocalGraphData = Record<string, unknown>;
export type LocalGraphVariables = Record<string, unknown>;
export type LocalGraphHandler = (context: LocalGraphContext) => GraphQueryResponse<LocalGraphData>;

export interface LocalGraphContext {
    state: LocalDemoState;
    variables: LocalGraphVariables;
    save: () => void;
}

export interface LocalDemoPlugin {
    name: string;
    graphHandlers?: Record<string, LocalGraphHandler>;
}
