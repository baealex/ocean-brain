import { describe, expect, it } from 'vitest';

import type { Note } from '~/models/note.model';
import type { LocalDemoState } from '../types';
import { normalizeTagName } from '../utils';
import { notesLocalPlugin } from './notes';

const createNote = (input: Pick<Note, 'id' | 'title' | 'tags'>): Note => ({
    content: '',
    pinned: false,
    order: 0,
    layout: 'wide',
    properties: [],
    createdAt: '1710000000000',
    updatedAt: '1710000000000',
    ...input,
});

const createState = (): LocalDemoState => {
    return {
        version: 6,
        notes: [
            createNote({
                id: 'note-guide-a',
                title: 'Guide A',
                tags: [{ id: 'tag-guide', name: '@guide' }],
            }),
            createNote({
                id: 'note-guide-b',
                title: 'Guide B',
                tags: [
                    { id: 'tag-guide', name: '@guide' },
                    { id: 'tag-demo', name: '@demo' },
                ],
            }),
            createNote({
                id: 'note-other',
                title: 'Other',
                tags: [{ id: 'tag-demo', name: '@demo' }],
            }),
        ],
        trashedNotes: [],
        tags: [
            { id: 'tag-guide', name: '@guide' },
            { id: 'tag-demo', name: '@demo' },
        ],
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
            activeGroupId: null,
            groups: [],
        },
    };
};

describe('notesLocalPlugin', () => {
    it('returns notes created or updated inside a calendar range', () => {
        const state = createState();
        state.notes = [
            createNote({ id: 'created-in-range', title: 'Created in range', tags: [] }),
            createNote({ id: 'updated-in-range', title: 'Updated in range', tags: [] }),
            createNote({ id: 'outside-range', title: 'Outside range', tags: [] }),
        ];
        state.notes[0].createdAt = '2026-08-05T00:00:00.000Z';
        state.notes[0].updatedAt = '2026-09-05T00:00:00.000Z';
        state.notes[1].createdAt = '2026-07-05T00:00:00.000Z';
        state.notes[1].updatedAt = '2026-08-06T00:00:00.000Z';
        state.notes[2].createdAt = '2026-07-05T00:00:00.000Z';
        state.notes[2].updatedAt = '2026-09-05T00:00:00.000Z';

        const handler = notesLocalPlugin.graphHandlers?.NotesInDateRange;
        expect(handler).toBeDefined();

        const response = handler?.({
            state,
            variables: {
                dateRange: {
                    start: '2026-08-01T00:00:00.000Z',
                    end: '2026-09-01T00:00:00.000Z',
                },
            },
            save: () => undefined,
        });
        const notes = response && 'notesInDateRange' in response ? (response.notesInDateRange as Note[]) : [];

        expect(notes.map((note) => note.id)).toEqual(['created-in-range', 'updated-in-range']);
    });

    it('rejects hash-prefixed tags instead of normalizing them', () => {
        expect(() => normalizeTagName('#guide')).toThrow('use @, not #');
    });

    it('keeps a property used as a saved calendar axis', () => {
        const state = createState();
        state.propertyDefinitions = [
            {
                key: 'due-date',
                name: 'Due date',
                valueType: 'date',
                options: [],
                updatedAt: '2026-08-13T00:00:00.000Z',
            },
        ];
        state.viewWorkspace = {
            activeGroupId: 'tab-1',
            groups: [
                {
                    id: 'tab-1',
                    title: 'Planning',
                    order: 0,
                    views: [
                        {
                            id: 'section-1',
                            groupId: 'tab-1',
                            title: 'Due dates',
                            displayType: 'calendar',
                            displayOptions: {
                                tableColumns: ['title'],
                                tablePropertyKeys: [],
                                boardGroupByPropertyKey: null,
                                calendarDateField: 'property',
                                calendarDatePropertyKey: 'due-date',
                            },
                            tagNames: [],
                            mode: 'and',
                            propertyFilters: [],
                            sortBy: 'updatedAt',
                            sortOrder: 'desc',
                            limit: 5,
                            order: 0,
                        },
                    ],
                },
            ],
        };
        const save = vi.fn();
        const handler = notesLocalPlugin.graphHandlers?.DeleteNotePropertyKey;

        const response = handler?.({ state, variables: { key: 'due-date' }, save });

        expect(response).toMatchObject({
            type: 'error',
            errors: [{ message: 'Property due-date is used by view Due dates and cannot be deleted.' }],
        });
        expect(state.propertyDefinitions).toHaveLength(1);
        expect(save).not.toHaveBeenCalled();
    });

    describe('renaming a select option value', () => {
        const todo = { id: 'option-todo', label: 'Todo', value: 'todo', color: null, order: 0 };
        const done = { id: 'option-done', label: 'Done', value: 'done', color: null, order: 1 };
        const renamedTodo = { ...todo, label: 'Task', value: 'task' };
        const selectProperty = (option: typeof todo) => ({
            key: 'status',
            name: 'Status',
            value: option.value,
            valueType: 'select' as const,
            option,
            createdAt: '1710000000000',
            updatedAt: '1710000000000',
        });

        const createStatusState = () => {
            const state = createState();
            state.propertyDefinitions = [
                {
                    key: 'status',
                    name: 'Status',
                    valueType: 'select',
                    options: [todo, done],
                    updatedAt: '2026-08-13T00:00:00.000Z',
                },
            ];
            state.notes[0].properties = [selectProperty(todo)];
            state.notes[1].properties = [selectProperty(done)];
            state.trashedNotes = [
                {
                    ...createNote({ id: 'note-trashed', title: 'Trashed', tags: [] }),
                    properties: [selectProperty(todo)],
                    deletedAt: '1710000000000',
                },
            ];
            state.viewWorkspace = {
                activeGroupId: 'tab-1',
                groups: [
                    {
                        id: 'tab-1',
                        title: 'Planning',
                        order: 0,
                        views: [
                            {
                                id: 'section-1',
                                groupId: 'tab-1',
                                title: 'Open work',
                                displayType: 'list',
                                displayOptions: {
                                    tableColumns: ['title'],
                                    tablePropertyKeys: [],
                                    boardGroupByPropertyKey: null,
                                    calendarDateField: 'updatedAt',
                                    calendarDatePropertyKey: null,
                                },
                                tagNames: [],
                                mode: 'and',
                                propertyFilters: [
                                    {
                                        key: 'status',
                                        name: 'Status',
                                        valueType: 'select',
                                        operator: 'equals',
                                        value: 'todo',
                                    },
                                ],
                                sortBy: 'updatedAt',
                                sortOrder: 'desc',
                                limit: 5,
                                order: 0,
                            },
                        ],
                    },
                ],
            };
            return state;
        };

        const renameTodoToTask = (state: LocalDemoState, save = vi.fn()) =>
            notesLocalPlugin.graphHandlers?.UpdateNotePropertyKey?.({
                state,
                variables: { key: 'status', input: { options: [renamedTodo, done] } },
                save,
            });

        it('saves the property definition when the value of an option is renamed', () => {
            const state = createStatusState();
            const save = vi.fn();

            const response = renameTodoToTask(state, save);

            expect(response).toMatchObject({ type: 'success' });
            expect(save).toHaveBeenCalled();
        });

        it('updates the value on a note that uses the renamed option', () => {
            const state = createStatusState();

            renameTodoToTask(state);

            expect(state.notes[0].properties[0]).toMatchObject({ value: 'task', option: { label: 'Task' } });
        });

        it('leaves a note that uses another option unchanged', () => {
            const state = createStatusState();

            renameTodoToTask(state);

            expect(state.notes[1].properties[0]).toMatchObject({ value: 'done', option: { label: 'Done' } });
        });

        it('updates the value on a trashed note that uses the renamed option', () => {
            const state = createStatusState();

            renameTodoToTask(state);

            expect(state.trashedNotes[0].properties[0]).toMatchObject({
                value: 'task',
                option: { id: 'option-todo' },
            });
        });

        it('updates the saved view filter that matches the renamed option', () => {
            const state = createStatusState();

            renameTodoToTask(state);

            expect(state.viewWorkspace.groups[0].views[0].propertyFilters[0].value).toBe('task');
        });
    });

    it('filters tagged notes by tag id for the tag notes page', () => {
        const handler = notesLocalPlugin.graphHandlers?.FetchTagNotes;
        expect(handler).toBeDefined();

        const response = handler?.({
            state: createState(),
            variables: {
                searchFilter: { query: 'tag-guide' },
                pagination: { limit: 25, offset: 0 },
            },
            save: () => undefined,
        });

        const tagNotes =
            response && 'tagNotes' in response
                ? (response.tagNotes as
                      | { totalCount: number; notes: Array<{ id: string; tags: Array<{ id: string }> }> }
                      | undefined)
                : undefined;

        expect(tagNotes?.totalCount).toBe(2);
        expect(tagNotes?.notes.map((note) => note.id)).toEqual(['note-guide-a', 'note-guide-b']);
    });

    it('returns linked and shared-tag notes for local search rediscovery', () => {
        const state = createState();
        state.notes[0].content = JSON.stringify([
            {
                type: 'paragraph',
                content: [{ type: 'reference', props: { id: 'note-guide-b', title: 'Guide B' } }],
            },
        ]);
        const handler = notesLocalPlugin.graphHandlers?.FetchSearchRelatedNotes;
        expect(handler).toBeDefined();

        const response = handler?.({
            state,
            variables: { noteId: 'note-guide-a', limit: 5 },
            save: () => undefined,
        });

        const relatedNotes =
            response && 'searchRelatedNotes' in response
                ? (response.searchRelatedNotes as { id: string; title: string; reasons: string[] }[] | undefined)
                : undefined;

        expect(relatedNotes).toEqual([
            {
                id: 'note-guide-b',
                title: 'Guide B',
                reasons: ['Linked from this note', 'Shares @guide'],
            },
        ]);
    });

    it('includes tags and update time in the local knowledge graph contract', () => {
        const state = createState();
        state.notes[0].content = JSON.stringify([
            {
                type: 'paragraph',
                content: [{ type: 'reference', props: { id: 'note-guide-b', title: 'Guide B' } }],
            },
        ]);
        const handler = notesLocalPlugin.graphHandlers?.FetchNoteGraph;
        expect(handler).toBeDefined();

        const response = handler?.({
            state,
            variables: {},
            save: () => undefined,
        });
        const noteGraph =
            response && 'noteGraph' in response
                ? (response.noteGraph as
                      | {
                            nodes: Array<{
                                id: string;
                                updatedAt: string;
                                tags: Array<{ id: string; name: string }>;
                            }>;
                            links: Array<{ source: string; target: string }>;
                        }
                      | undefined)
                : undefined;

        expect(noteGraph?.links).toContainEqual({ source: 'note-guide-a', target: 'note-guide-b' });
        expect(noteGraph?.nodes.find((node) => node.id === 'note-guide-a')).toMatchObject({
            updatedAt: '1710000000000',
            tags: [{ id: 'tag-guide', name: '@guide' }],
        });
    });
});

it('local demo backlinks preserve the source block and distinguish equally named references', async () => {
    const state = createState();
    const source = createNote({ id: 'source', title: 'Meeting', tags: [] });
    source.content = JSON.stringify([
        {
            id: 'decision',
            type: 'paragraph',
            content: [
                { type: 'reference', props: { id: 'other', title: 'Same title' } },
                { type: 'text', text: ' differs from ' },
                { type: 'reference', props: { id: 'target', title: 'Same title' } },
            ],
        },
    ]);
    state.notes = [source];

    const result = await notesLocalPlugin.graphHandlers.FetchBackReferenceDetails({
        state,
        variables: { id: 'target', limit: 20, offset: 0 },
        save: () => undefined,
    });

    expect(result).toMatchObject({
        backReferenceDetails: {
            hasMore: false,
            nextOffset: null,
            references: [
                {
                    id: 'source',
                    contexts: [
                        {
                            blockId: 'decision',
                            segments: [
                                { text: 'Same title', isTarget: false },
                                { text: ' differs from ', isTarget: false },
                                { text: 'Same title', isTarget: true },
                            ],
                        },
                    ],
                },
            ],
        },
    });
});

describe('trashed note payload', () => {
    const paragraph = (text: string) => [{ type: 'paragraph', content: [{ type: 'text', text, styles: {} }] }];
    const createTrashedState = (content: string, deletedAt: string) => {
        const state = createState();
        state.trashedNotes = [
            {
                ...createNote({ id: 'note-trashed', title: 'Trashed', tags: [] }),
                content,
                deletedAt,
            },
        ];
        return state;
    };
    const fetchTrashedNote = (state: LocalDemoState) => {
        const response = notesLocalPlugin.graphHandlers?.FetchTrashedNotes?.({
            state,
            variables: { pagination: { limit: 25, offset: 0 } },
            save: () => undefined,
        });
        if (response?.type !== 'success') throw new Error('Expected a successful response');
        return (response as unknown as { trashedNotes: { notes: Array<Record<string, unknown>> } }).trashedNotes
            .notes[0];
    };

    it('lists visible text instead of BlockNote JSON as the preview of a trashed note', () => {
        const state = createTrashedState(JSON.stringify(paragraph('Visible body')), '1710000000000');

        const note = fetchTrashedNote(state);

        expect(note.contentPreview).toBe('Visible body');
    });

    it('truncates the preview of a long trashed note with an ellipsis like the server', () => {
        const state = createTrashedState(JSON.stringify(paragraph('a'.repeat(300))), '1710000000000');

        const note = fetchTrashedNote(state);

        expect(note.contentPreview).toBe(`${'a'.repeat(240)}…`);
    });

    it('lists a millisecond deletion timestamp as an ISO string', () => {
        const state = createTrashedState('[]', '1710000000000');

        const note = fetchTrashedNote(state);

        expect(note.deletedAt).toBe('2024-03-09T16:00:00.000Z');
    });

    it('shows one line per block as the content of a trashed note detail', () => {
        const state = createTrashedState(
            JSON.stringify([...paragraph('First line'), ...paragraph('Second line')]),
            '1710000000000',
        );

        const response = notesLocalPlugin.graphHandlers?.FetchTrashedNote?.({
            state,
            variables: { id: 'note-trashed' },
            save: () => undefined,
        }) as unknown as { trashedNote: { contentAsMarkdown: string } };

        expect(response.trashedNote.contentAsMarkdown).toBe('First line\nSecond line');
    });

    it('lists millisecond created and updated timestamps of a trashed note as ISO strings', () => {
        const state = createTrashedState('[]', '1710000000000');

        const note = fetchTrashedNote(state);

        expect([note.createdAt, note.updatedAt]).toEqual(['2024-03-09T16:00:00.000Z', '2024-03-09T16:00:00.000Z']);
    });
});

describe('note list previews', () => {
    const createPreviewState = () => {
        const state = createState();
        state.notes[0].content = JSON.stringify([
            { type: 'paragraph', content: [{ type: 'text', text: 'Visible body', styles: {} }] },
        ]);
        return state;
    };

    it.each([
        ['FetchNotes', 'allNotes', {}],
        ['FetchSearchNotes', 'searchNotes', { query: 'Guide A' }],
        ['FetchTagNotes', 'tagNotes', { searchFilter: { query: 'tag-guide' } }],
        ['FetchNotesByTagNames', 'notesByTagNames', { tagNames: ['@guide'], mode: 'and' }],
    ])('%s lists visible text as the preview of a note', (handlerName, field, variables) => {
        const state = createPreviewState();

        const response = notesLocalPlugin.graphHandlers?.[handlerName]?.({
            state,
            variables: { pagination: { limit: 25, offset: 0 }, ...variables },
            save: () => undefined,
        }) as unknown as Record<string, { notes: Array<{ id: string; contentPreview?: string }> }>;

        expect(response[field].notes.find((note) => note.id === 'note-guide-a')?.contentPreview).toBe('Visible body');
    });
});
