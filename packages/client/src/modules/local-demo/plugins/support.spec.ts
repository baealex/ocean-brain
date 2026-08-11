import type { Note } from '~/models/note.model';
import { createLocalDemoState } from '~/test/local-demo-state';

import { cacheLocalPlugin } from './cache';
import { imagesLocalPlugin } from './images';
import { placeholdersLocalPlugin } from './placeholders';
import { tagsLocalPlugin } from './tags';

const createNote = (id: string, content: string, tagNames: string[] = []): Note => ({
    id,
    title: id,
    content,
    pinned: false,
    order: 0,
    layout: 'wide',
    tags: tagNames.map((name) => ({ id: name, name })),
    properties: [],
    createdAt: '1710000000000',
    updatedAt: '1710000000000',
});

describe('local demo support plugins', () => {
    it('filters tags and sorts them by note reference count', () => {
        const state = createLocalDemoState();
        state.tags = [
            { id: 'tag-guide', name: '@guide' },
            { id: 'tag-game', name: '@game' },
        ];
        state.notes = [createNote('note-1', '', ['@guide']), createNote('note-2', '', ['@guide', '@game'])];
        const handler = tagsLocalPlugin.graphHandlers?.FetchTags;

        const response = handler?.({
            state,
            variables: {
                searchFilter: { query: 'g', sortBy: 'referenceCount', sortOrder: 'desc' },
                pagination: { limit: 50, offset: 0 },
            },
            save: vi.fn(),
        });
        const result = response && 'allTags' in response ? response.allTags : undefined;

        expect(result?.tags).toEqual([
            { id: 'tag-guide', name: '@guide', referenceCount: 2 },
            { id: 'tag-game', name: '@game', referenceCount: 1 },
        ]);
    });

    it('reports the filtered placeholder count used by pagination', () => {
        const state = createLocalDemoState();
        state.placeholders = [
            { id: 1, name: 'Project', template: 'project', replacement: 'Ocean Brain', createdAt: '1', updatedAt: '1' },
            { id: 2, name: 'Meeting', template: 'meeting', replacement: 'Sync', createdAt: '1', updatedAt: '1' },
        ];
        const handler = placeholdersLocalPlugin.graphHandlers?.FetchPlaceholders;

        const response = handler?.({
            state,
            variables: { searchFilter: { query: 'Project' }, pagination: { limit: 25, offset: 0 } },
            save: vi.fn(),
        });
        const result = response && 'allPlaceholders' in response ? response.allPlaceholders : undefined;

        expect(result?.totalCount).toBe(1);
        expect(result?.placeholders.map((placeholder) => placeholder.id)).toEqual([1]);
    });

    it('calculates image reference counts from note content', () => {
        const state = createLocalDemoState();
        state.images = [{ id: 'image-1', url: '/assets/images/one.png' }];
        state.notes = [createNote('note-1', '![One](/assets/images/one.png)'), createNote('note-2', 'No image here')];
        const handler = imagesLocalPlugin.graphHandlers?.FetchImages;

        const response = handler?.({
            state,
            variables: { pagination: { limit: 50, offset: 0 } },
            save: vi.fn(),
        });
        const result = response && 'allImages' in response ? response.allImages : undefined;

        expect(result?.images).toEqual([{ id: 'image-1', url: '/assets/images/one.png', referenceCount: 1 }]);
    });

    it('round-trips encoded cache values through the local store', () => {
        const state = createLocalDemoState();
        const save = vi.fn();
        const setHandler = cacheLocalPlugin.graphHandlers?.SetServerCache;
        const getHandler = cacheLocalPlugin.graphHandlers?.GetServerCache;

        setHandler?.({
            state,
            variables: { key: 'sidebar', value: 'hello%20world' },
            save,
        });
        const response = getHandler?.({
            state,
            variables: { key: 'sidebar' },
            save,
        });

        expect(response).toEqual({ type: 'success', cache: { value: 'hello world' } });
        expect(save).toHaveBeenCalledTimes(1);
    });
});
