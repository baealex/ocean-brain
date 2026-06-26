import { describe, expect, it } from 'vitest';

import type { Note } from '~/models/note.model';
import type { LocalDemoState } from '../types';
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
        version: 5,
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
});
