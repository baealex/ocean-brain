import { describe, expect, it } from 'vitest';

import type { Note } from '~/models/note.model';
import type { View } from '~/models/view.model';
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

const createState = (view: View): LocalDemoState => ({
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
        activeGroupId: 'group-1',
        groups: [{ id: 'group-1', title: 'Views', order: 0, views: [view] }],
    },
});

const createView = (sortBy: View['sortBy'], sortOrder: View['sortOrder']): View => ({
    id: 'view-1',
    groupId: 'group-1',
    title: 'All notes',
    displayType: 'list',
    displayOptions: {
        tableColumns: ['title'],
        tablePropertyKeys: [],
        boardGroupByPropertyKey: null,
        calendarDateField: 'createdAt',
        calendarDatePropertyKey: null,
    },
    tagNames: [],
    mode: 'and',
    propertyFilters: [],
    sortBy,
    sortOrder,
    limit: 5,
    order: 0,
});

describe('viewsLocalPlugin', () => {
    it('inherits the template title when a new view note has no explicit title', () => {
        const view = { ...createView('updatedAt', 'desc'), defaultTemplateNoteId: 'note-2' };
        const state = createState(view);

        const response = viewsLocalPlugin.graphHandlers?.CreateNoteInView({
            state,
            save: vi.fn(),
            variables: { viewId: view.id, input: { title: '', tagNames: [] } },
        });

        expect(response?.type).toBe('success');
        expect(state.notes[0]?.title).toBe('Beta');
    });

    it('preserves an empty text property inherited from a template', () => {
        const view = { ...createView('updatedAt', 'desc'), defaultTemplateNoteId: 'note-2' };
        const state = createState(view);
        state.propertyDefinitions = [{ key: 'owner', name: 'Owner', valueType: 'text', options: [], updatedAt: '1' }];
        state.notes[0]!.properties = [
            { key: 'owner', name: 'Owner', valueType: 'text', value: '', option: null, createdAt: '1', updatedAt: '1' },
        ];

        const response = viewsLocalPlugin.graphHandlers?.CreateNoteInView({
            state,
            save: vi.fn(),
            variables: { viewId: view.id, input: { title: 'Meeting', tagNames: [] } },
        });

        expect(response?.type).toBe('success');
        expect(state.notes[0]?.properties).toEqual([expect.objectContaining({ key: 'owner', value: '' })]);
    });
    it('copies a demo template without changing its source or inheriting its old tags', () => {
        const view = { ...createView('updatedAt', 'desc'), defaultTemplateNoteId: 'note-2', tagNames: ['@project-a'] };
        const state = createState(view);
        const template = state.notes[0];
        if (!template) throw new Error('Missing fixture template');
        template.content = JSON.stringify([
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Agenda', styles: {} },
                    { type: 'tag', props: { id: 'old', tag: '@old-project' } },
                ],
                children: [],
            },
        ]);
        const original = structuredClone(template);

        const response = viewsLocalPlugin.graphHandlers?.CreateNoteInView({
            state,
            save: vi.fn(),
            variables: {
                viewId: view.id,
                input: { title: 'Planning', tagNames: ['@project-a'] },
            },
        });

        expect(response?.type).toBe('success');
        expect(state.notes[0]?.content).toContain('Agenda');
        expect(state.notes[0]?.content).not.toContain('@old-project');
        expect(state.notes.find((note) => note.id === original.id)).toEqual(original);
    });

    it('creates a demo note inside its view with the inherited tags', () => {
        const view = { ...createView('updatedAt', 'desc'), tagNames: ['@project-a'] };
        const state = createState(view);
        const save = vi.fn();

        const response = viewsLocalPlugin.graphHandlers?.CreateNoteInView({
            state,
            save,
            variables: {
                viewId: view.id,
                input: { title: 'Project meeting', tagNames: ['@project-a'] },
            },
        });

        expect(response?.type).toBe('success');
        expect(state.notes[0]?.title).toBe('Project meeting');
        expect(state.notes[0]?.tags.map((tag) => tag.name)).toEqual(['@project-a']);
        expect(state.notes[0]?.content).toContain('@project-a');
        expect(save).toHaveBeenCalledOnce();
    });

    it('leaves demo state untouched when no OR tag was selected', () => {
        const view = { ...createView('updatedAt', 'desc'), tagNames: ['@meeting', '@decision'], mode: 'or' as const };
        const state = createState(view);
        const before = structuredClone(state);
        const save = vi.fn();

        const response = viewsLocalPlugin.graphHandlers?.CreateNoteInView({
            state,
            save,
            variables: {
                viewId: view.id,
                input: { title: 'Unclassified', tagNames: [] },
            },
        });

        expect(response?.type).toBe('error');
        expect(state).toEqual(before);
        expect(save).not.toHaveBeenCalled();
    });

    it.each([
        ['title', 'asc', ['note-1', 'note-2', 'note-3']],
        ['createdAt', 'desc', ['note-3', 'note-2', 'note-1']],
        ['updatedAt', 'asc', ['note-2', 'note-1', 'note-3']],
    ] as const)('sorts view notes by %s %s like the server', (sortBy, sortOrder, expectedIds) => {
        const handler = viewsLocalPlugin.graphHandlers?.FetchViewNotes;
        const response = handler?.({
            state: createState(createView(sortBy, sortOrder)),
            variables: { id: 'view-1', pagination: { limit: 5, offset: 0 } },
            save: () => undefined,
        });
        const result = response?.viewNotes as { notes: Note[] } | undefined;

        expect(result?.notes.map((note) => note.id)).toEqual(expectedIds);
    });

    it('uses request sorting for URL-restored table state', () => {
        const handler = viewsLocalPlugin.graphHandlers?.FetchViewNotes;
        const response = handler?.({
            state: createState(createView('updatedAt', 'desc')),
            variables: {
                id: 'view-1',
                pagination: { limit: 5, offset: 0 },
                sortBy: 'title',
                sortOrder: 'asc',
            },
            save: () => undefined,
        });
        const result = response?.viewNotes as { notes: Note[] } | undefined;

        expect(result?.notes.map((note) => note.id)).toEqual(['note-1', 'note-2', 'note-3']);
    });

    it('filters calendar views by their configured date field and visible range', () => {
        const handler = viewsLocalPlugin.graphHandlers?.FetchViewCalendarNotes;
        const view = createView('updatedAt', 'desc');
        view.displayType = 'calendar';
        view.displayOptions.calendarDateField = 'createdAt';
        const response = handler?.({
            state: createState(view),
            variables: {
                id: 'view-1',
                dateRange: {
                    start: new Date(1_710_000_001_500).toISOString(),
                    end: new Date(1_710_000_003_500).toISOString(),
                },
            },
            save: () => undefined,
        });
        const notes = response?.viewCalendarNotes as Note[] | undefined;

        expect(notes?.map((note) => note.id)).toEqual(['note-2', 'note-3']);
    });

    it('uses a date property as the calendar placement field', () => {
        const handler = viewsLocalPlugin.graphHandlers?.FetchViewCalendarNotes;
        const view = createView('updatedAt', 'desc');
        view.displayType = 'calendar';
        view.displayOptions.calendarDateField = 'property';
        view.displayOptions.calendarDatePropertyKey = 'due-date';
        const state = createState(view);
        state.propertyDefinitions = [
            {
                key: 'due-date',
                name: 'Due date',
                valueType: 'date',
                options: [],
                updatedAt: '2026-08-01T00:00:00.000Z',
            },
        ];
        state.notes[0]!.properties = [
            {
                key: 'due-date',
                name: 'Due date',
                value: '2026-08-12',
                valueType: 'date',
                option: null,
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-08-01T00:00:00.000Z',
            },
        ];

        const response = handler?.({
            state,
            variables: {
                id: 'view-1',
                dateRange: {
                    start: '2026-08-01T00:00:00.000Z',
                    end: '2026-09-01T00:00:00.000Z',
                },
            },
            save: () => undefined,
        });

        expect(response?.viewCalendarNotes).toEqual([{ id: 'note-2', title: 'Beta', calendarDate: '2026-08-12' }]);
    });
});
