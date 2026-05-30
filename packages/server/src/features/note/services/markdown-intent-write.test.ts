import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarkdownIntentWriteService } from './markdown-intent-write.js';
import { createNoteVersionConflictError } from './write-conflict.js';

const createNote = (input?: { content?: string; updatedAt?: Date }) => ({
    id: 7,
    title: 'Existing',
    content: input?.content ?? 'Original sentence.',
    layout: 'wide' as const,
    updatedAt: input?.updatedAt ?? new Date('2026-05-28T00:00:00.000Z'),
});

test('markdown intent write applies an exact text patch through guarded update and snapshot', async () => {
    const updates: unknown[] = [];
    const service = createMarkdownIntentWriteService({
        findNoteById: async () => createNote({ content: 'Original sentence.' }),
        renderMarkdown: async (content) => content,
        parseMarkdownToContentJson: async (markdown) => `json:${markdown}`,
        extractTagIds: () => ['3'],
        updateNote: async (input) => {
            updates.push(input);
            return {
                note: {
                    id: input.id,
                    title: 'Existing',
                    content: input.data.content ?? '',
                    layout: 'wide',
                    pinned: false,
                    order: 0,
                    createdAt: new Date('2026-05-28T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-28T00:00:01.000Z'),
                },
                snapshot: {
                    id: '11',
                    createdAt: '2026-05-28T00:00:00.500Z',
                    meta: { label: 'MCP' },
                },
            };
        },
    });

    const result = await service.patchNoteMarkdown({
        id: 7,
        expectedUpdatedAt: '2026-05-28T00:00:00.000Z',
        intent: 'Replace one sentence',
        selector: {
            type: 'exact_text',
            text: 'Original sentence.',
        },
        operation: {
            type: 'replace',
            replacement: 'Updated sentence. [@MCP]',
        },
        dryRun: false,
    });

    assert.equal(result.status, 'applied');

    if (result.status !== 'applied') {
        throw new Error('expected applied result');
    }

    assert.deepEqual(updates, [
        {
            id: 7,
            data: {
                content: 'json:Updated sentence. [@MCP]',
                tagIds: [3],
            },
            expectedUpdatedAt: '2026-05-28T00:00:00.000Z',
            snapshotMeta: '{"entrypoint":"mcp","label":"MCP"}',
        },
    ]);
    assert.deepEqual(result.snapshot, {
        id: '11',
        label: 'MCP',
        createdAt: '2026-05-28T00:00:00.500Z',
    });
});

test('markdown intent write refuses apply when the note changed after preview baseline', async () => {
    const service = createMarkdownIntentWriteService({
        findNoteById: async () => createNote({ updatedAt: new Date('2026-05-28T00:00:02.000Z') }),
        renderMarkdown: async (content) => content,
        parseMarkdownToContentJson: async () => {
            throw new Error('should not parse');
        },
        extractTagIds: () => [],
        updateNote: async () => {
            throw new Error('should not update');
        },
    });

    const result = await service.patchNoteMarkdown({
        id: 7,
        expectedUpdatedAt: '2026-05-28T00:00:00.000Z',
        intent: 'Replace one sentence',
        selector: {
            type: 'exact_text',
            text: 'Original sentence.',
        },
        operation: {
            type: 'replace',
            replacement: 'Updated sentence.',
        },
        dryRun: false,
    });

    assert.deepEqual(result, {
        status: 'failed',
        reason: 'BASELINE_MISMATCH',
        message: 'The markdown write baseline does not match the current note.',
    });
});

test('markdown intent write refuses markdown writes for unsupported BlockNote-only structures', async () => {
    const service = createMarkdownIntentWriteService({
        findNoteById: async () => createNote({ content: 'blocknote-json' }),
        renderMarkdown: async () => {
            throw new Error('should not render unsafe source');
        },
        parseMarkdownToContentJson: async () => {
            throw new Error('should not parse');
        },
        extractTagIds: () => [],
        hasUnsupportedMarkdownBlocks: () => true,
        updateNote: async () => {
            throw new Error('should not update');
        },
    });

    const result = await service.patchNoteMarkdown({
        id: 7,
        expectedUpdatedAt: '2026-05-28T00:00:00.000Z',
        intent: 'Replace one sentence',
        selector: {
            type: 'exact_text',
            text: 'Original sentence.',
        },
        operation: {
            type: 'replace',
            replacement: 'Updated sentence.',
        },
        dryRun: false,
    });

    assert.deepEqual(result, {
        status: 'failed',
        reason: 'UNSUPPORTED_MARKDOWN_STRUCTURE',
        message: 'This note contains BlockNote content that cannot be safely represented as Markdown.',
    });
});

test('markdown intent write refuses apply when structured references would be lost', async () => {
    const service = createMarkdownIntentWriteService({
        findNoteById: async () => createNote({ content: 'before-content' }),
        renderMarkdown: async () => 'See [[Shared Title]]\n\nOriginal sentence.',
        parseMarkdownToContentJson: async () => 'after-content',
        extractTagIds: () => [],
        countReferenceInlines: (content) => (content === 'before-content' ? 1 : 0),
        updateNote: async () => {
            throw new Error('should not update');
        },
    });

    const result = await service.patchNoteMarkdown({
        id: 7,
        expectedUpdatedAt: '2026-05-28T00:00:00.000Z',
        intent: 'Replace one sentence',
        selector: {
            type: 'exact_text',
            text: 'Original sentence.',
        },
        operation: {
            type: 'replace',
            replacement: 'Updated sentence.',
        },
        dryRun: false,
    });

    assert.deepEqual(result, {
        status: 'failed',
        reason: 'REFERENCE_STRUCTURE_DECREASED',
        message: 'The markdown write would reduce structured note reference links.',
    });
});

test('markdown intent write maps guarded update conflicts to baseline mismatch failures', async () => {
    const service = createMarkdownIntentWriteService({
        findNoteById: async () => createNote(),
        renderMarkdown: async (content) => content,
        parseMarkdownToContentJson: async (markdown) => `json:${markdown}`,
        extractTagIds: () => [],
        updateNote: async () => {
            throw createNoteVersionConflictError({
                expectedUpdatedAt: Date.parse('2026-05-28T00:00:00.000Z'),
                currentUpdatedAt: Date.parse('2026-05-28T00:00:01.000Z'),
            });
        },
    });

    const result = await service.patchNoteMarkdown({
        id: 7,
        expectedUpdatedAt: '2026-05-28T00:00:00.000Z',
        intent: 'Replace one sentence',
        selector: {
            type: 'exact_text',
            text: 'Original sentence.',
        },
        operation: {
            type: 'replace',
            replacement: 'Updated sentence.',
        },
        dryRun: false,
    });

    assert.deepEqual(result, {
        status: 'failed',
        reason: 'BASELINE_MISMATCH',
        message: 'The markdown write baseline does not match the current note.',
    });
});

test('metadata update accepts epoch millisecond note versions', async () => {
    const service = createMarkdownIntentWriteService({
        findNoteById: async () => createNote(),
        renderMarkdown: async (content) => content,
        parseMarkdownToContentJson: async () => {
            throw new Error('should not parse markdown for metadata');
        },
        extractTagIds: () => [],
        updateNote: async () => {
            throw new Error('should not update during preview');
        },
    });

    const result = await service.updateNoteMetadata({
        id: 7,
        expectedUpdatedAt: String(Date.parse('2026-05-28T00:00:00.000Z')),
        title: 'Renamed',
    });

    assert.equal(result.status, 'dry_run');
});

test('metadata update applies title and layout without content data', async () => {
    const updates: unknown[] = [];
    const service = createMarkdownIntentWriteService({
        findNoteById: async () => createNote(),
        renderMarkdown: async (content) => content,
        parseMarkdownToContentJson: async () => {
            throw new Error('should not parse markdown for metadata');
        },
        extractTagIds: () => [],
        updateNote: async (input) => {
            updates.push(input);
            return {
                note: {
                    id: input.id,
                    title: input.data.title ?? 'Existing',
                    content: 'untouched',
                    layout: input.data.layout ?? 'wide',
                    pinned: false,
                    order: 0,
                    createdAt: new Date('2026-05-28T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-28T00:00:01.000Z'),
                },
                snapshot: {
                    id: '12',
                    createdAt: '2026-05-28T00:00:00.500Z',
                    meta: { label: 'MCP' },
                },
            };
        },
    });

    const result = await service.applyNoteMetadata({
        id: 7,
        expectedUpdatedAt: '2026-05-28T00:00:00.000Z',
        title: 'Renamed',
        layout: 'full',
    });

    assert.equal(result.status, 'applied');
    assert.deepEqual(updates, [
        {
            id: 7,
            data: {
                title: 'Renamed',
                layout: 'full',
            },
            expectedUpdatedAt: '2026-05-28T00:00:00.000Z',
            snapshotMeta: '{"entrypoint":"mcp","label":"MCP"}',
        },
    ]);
});
