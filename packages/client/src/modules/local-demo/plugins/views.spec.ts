import { describe, expect, it } from 'vitest';

import type { Note } from '~/models/note.model';
import type { ViewSection } from '~/models/view.model';
import type { LocalDemoState } from '../types';
import { viewsLocalPlugin } from './views';

const createNote = (id: string, title: string, createdAt: string, updatedAt: string): Note => ({
    id,
    title,
    content: '',
    pinned: false,
    order: 0,
    layout: 'wide',
    tags: [],
    properties: [],
    createdAt,
    updatedAt,
});

const createState = (section: ViewSection): LocalDemoState => ({
    version: 6,
    notes: [
        createNote('note-2', 'Beta', '1710000002000', '1710000001000'),
        createNote('note-1', 'Alpha', '1710000001000', '1710000002000'),
        createNote('note-3', 'Gamma', '1710000003000', '1710000003000'),
    ],
    trashedNotes: [],
    tags: [],
    reminders: [],
    placeholders: [],
    images: [],
    cache: {},
    propertyDefinitions: [],
    mcp: {
        enabled: false,
        hasActiveToken: false,
        token: null,
    },
    viewWorkspace: {
        activeTabId: 'tab-1',
        tabs: [{ id: 'tab-1', title: 'Views', order: 0, sections: [section] }],
    },
});

const createSection = (sortBy: ViewSection['sortBy'], sortOrder: ViewSection['sortOrder']): ViewSection => ({
    id: 'section-1',
    tabId: 'tab-1',
    title: 'All notes',
    displayType: 'list',
    displayOptions: { tableColumns: ['title'], tablePropertyKeys: [], boardGroupByPropertyKey: null },
    tagNames: [],
    mode: 'and',
    propertyFilters: [],
    sortBy,
    sortOrder,
    limit: 5,
    order: 0,
});

describe('viewsLocalPlugin', () => {
    it.each([
        ['title', 'asc', ['note-1', 'note-2', 'note-3']],
        ['createdAt', 'desc', ['note-3', 'note-2', 'note-1']],
        ['updatedAt', 'asc', ['note-2', 'note-1', 'note-3']],
    ] as const)('sorts section notes by %s %s like the server', (sortBy, sortOrder, expectedIds) => {
        const handler = viewsLocalPlugin.graphHandlers?.FetchViewSectionNotes;
        const response = handler?.({
            state: createState(createSection(sortBy, sortOrder)),
            variables: { id: 'section-1', pagination: { limit: 5, offset: 0 } },
            save: () => undefined,
        });
        const result = response?.viewSectionNotes as { notes: Note[] } | undefined;

        expect(result?.notes.map((note) => note.id)).toEqual(expectedIds);
    });

    it('uses request sorting for URL-restored table state', () => {
        const handler = viewsLocalPlugin.graphHandlers?.FetchViewSectionNotes;
        const response = handler?.({
            state: createState(createSection('updatedAt', 'desc')),
            variables: {
                id: 'section-1',
                pagination: { limit: 5, offset: 0 },
                sortBy: 'title',
                sortOrder: 'asc',
            },
            save: () => undefined,
        });
        const result = response?.viewSectionNotes as { notes: Note[] } | undefined;

        expect(result?.notes.map((note) => note.id)).toEqual(['note-1', 'note-2', 'note-3']);
    });
});
