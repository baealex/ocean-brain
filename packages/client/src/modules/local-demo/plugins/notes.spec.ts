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
            activeTabId: null,
            tabs: [],
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
