import assert from 'node:assert/strict';
import test from 'node:test';
import { extractNoteReferenceIds, replaceNoteReferences } from './note-reference-index.js';

const referenceContent = (ids: Array<number | string>) =>
    JSON.stringify(
        ids.map((id) => ({
            type: 'paragraph',
            content: [{ type: 'reference', props: { id: String(id) } }],
        })),
    );

test('extractNoteReferenceIds keeps valid unique numeric references', () => {
    assert.deepEqual(extractNoteReferenceIds(referenceContent([2, '2', 3, 'invalid'])), [2, 3]);
});

test('replaceNoteReferences replaces a source note index without requiring targets to exist yet', async () => {
    const operations: unknown[] = [];
    const db = {
        noteReference: {
            deleteMany: async (input: unknown) => {
                operations.push({ type: 'deleteMany', input });
                return { count: 0 };
            },
            createMany: async (input: unknown) => {
                operations.push({ type: 'createMany', input });
                return { count: 2 };
            },
        },
    } as unknown as Parameters<typeof replaceNoteReferences>[0];

    const count = await replaceNoteReferences(db, 2, referenceContent([2, 3, 999999]));

    assert.equal(count, 2);
    assert.deepEqual(operations, [
        { type: 'deleteMany', input: { where: { sourceNoteId: 2 } } },
        {
            type: 'createMany',
            input: {
                data: [
                    { sourceNoteId: 2, targetNoteId: 3 },
                    { sourceNoteId: 2, targetNoteId: 999999 },
                ],
            },
        },
    ]);
});
