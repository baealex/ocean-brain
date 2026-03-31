import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createNoteAuthoringService,
    InvalidNoteAuthoringInputError
} from '../src/modules/note-authoring.js';

test('note authoring create converts markdown after placeholder replacement', async () => {
    const created: Array<{ title: string; content: string; layout?: 'wide' | 'narrow' | 'full' }> = [];
    const service = createNoteAuthoringService({
        createNote: async (input) => {
            created.push(input);
            return {
                id: 4,
                title: input.title,
                content: input.content,
                layout: input.layout ?? 'wide',
                createdAt: new Date('2026-03-31T00:00:00.000Z'),
                updatedAt: new Date('2026-03-31T00:00:00.000Z')
            };
        },
        findNoteById: async () => null,
        findPlaceholders: async () => [{
            template: 'today',
            replacement: '2026-03-31'
        }],
        parseMarkdownToContentJson: async (markdown) => JSON.stringify([{
            type: 'paragraph',
            markdown
        }]),
        captureBaseline: async () => undefined,
        updateNote: async () => {
            throw new Error('should not update');
        }
    });

    const result = await service.createNote({
        title: 'Plan {%today%}',
        markdown: 'Body for {%today%}',
        layout: 'full'
    });

    assert.deepEqual(created[0], {
        title: 'Plan 2026-03-31',
        content: JSON.stringify([{
            type: 'paragraph',
            markdown: 'Body for 2026-03-31'
        }]),
        layout: 'full'
    });
    assert.deepEqual(result, {
        id: '4',
        title: 'Plan 2026-03-31',
        layout: 'full',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z'
    });
});

test('note authoring update returns null when the note does not exist', async () => {
    const service = createNoteAuthoringService({
        createNote: async () => {
            throw new Error('should not create');
        },
        findNoteById: async () => null,
        findPlaceholders: async () => [],
        parseMarkdownToContentJson: async () => '[]',
        captureBaseline: async () => undefined,
        updateNote: async () => {
            throw new Error('should not update');
        }
    });

    const result = await service.updateNote({
        id: 9,
        markdown: 'Updated body'
    });

    assert.equal(result, null);
});

test('note authoring update requires at least one change field', async () => {
    const service = createNoteAuthoringService({
        createNote: async () => {
            throw new Error('should not create');
        },
        findNoteById: async () => ({
            id: 9,
            title: 'Existing',
            content: '[]',
            layout: 'wide',
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
            updatedAt: new Date('2026-03-31T00:00:00.000Z')
        }),
        findPlaceholders: async () => [],
        parseMarkdownToContentJson: async () => '[]',
        captureBaseline: async () => undefined,
        updateNote: async () => {
            throw new Error('should not update');
        }
    });

    await assert.rejects(
        () => service.updateNote({ id: 9 }),
        InvalidNoteAuthoringInputError
    );
});

test('note authoring update replaces provided fields only', async () => {
    const updated: Array<{ id: number; input: { title?: string; content?: string; layout?: 'wide' | 'narrow' | 'full' } }> = [];
    const service = createNoteAuthoringService({
        createNote: async () => {
            throw new Error('should not create');
        },
        findNoteById: async () => ({
            id: 7,
            title: 'Existing',
            content: '[]',
            layout: 'wide',
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
            updatedAt: new Date('2026-03-31T00:00:00.000Z')
        }),
        findPlaceholders: async () => [],
        parseMarkdownToContentJson: async (markdown) => JSON.stringify([{
            type: 'paragraph',
            markdown
        }]),
        captureBaseline: async () => undefined,
        updateNote: async (id, input) => {
            updated.push({
                id,
                input
            });
            return {
                id,
                title: input.title ?? 'Existing',
                content: input.content ?? '[]',
                layout: input.layout ?? 'wide',
                createdAt: new Date('2026-03-31T00:00:00.000Z'),
                updatedAt: new Date('2026-04-01T00:00:00.000Z')
            };
        }
    });

    const result = await service.updateNote({
        id: 7,
        title: 'Renamed',
        markdown: 'Updated body'
    });

    assert.deepEqual(updated[0], {
        id: 7,
        input: {
            title: 'Renamed',
            content: JSON.stringify([{
                type: 'paragraph',
                markdown: 'Updated body'
            }])
        }
    });
    assert.deepEqual(result, {
        id: '7',
        title: 'Renamed',
        layout: 'wide',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z'
    });
});
