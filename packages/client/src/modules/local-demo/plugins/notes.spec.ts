import { describe, expect, it } from 'vitest';

import { createLocalDemoSeed } from '../seed';
import type { LocalDemoState, LocalTag } from '../types';
import { notesLocalPlugin } from './notes';

const createState = (): LocalDemoState => {
    const tags: LocalTag[] = [
        { id: 'tag-guide', name: '@guide' },
        { id: 'tag-demo', name: '@demo' },
        { id: 'tag-graph', name: '@graph' },
        { id: 'tag-project', name: '@project' },
        { id: 'tag-task', name: '@task' },
        { id: 'tag-research', name: '@research' },
        { id: 'tag-meeting', name: '@meeting' },
        { id: 'tag-editor', name: '@editor' },
        { id: 'tag-media', name: '@media' },
        { id: 'tag-archive', name: '@archive' },
    ];
    const seed = createLocalDemoSeed({ tags, nowMs: 1_710_000_000_000 });

    return {
        version: 4,
        notes: seed.notes,
        trashedNotes: [],
        tags,
        reminders: seed.reminders,
        placeholders: [],
        images: [],
        cache: {},
        propertyDefinitions: seed.propertyDefinitions,
        mcp: {
            enabled: false,
            hasActiveToken: false,
            token: null,
        },
        viewWorkspace: {
            activeTabId: seed.viewTabs[0]?.id ?? null,
            tabs: seed.viewTabs,
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
                      | { totalCount: number; notes: Array<{ tags: Array<{ id: string }> }> }
                      | undefined)
                : undefined;

        expect(tagNotes?.totalCount).toBe(3);
        expect(tagNotes?.notes).toHaveLength(3);
        expect(tagNotes?.notes.every((note) => note.tags.some((tag) => tag.id === 'tag-guide'))).toBe(true);
    });
});
