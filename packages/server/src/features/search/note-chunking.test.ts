import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNoteEmbeddingChunks, splitSearchText } from './note-chunking.js';

const paragraphContent = (text: string) =>
    JSON.stringify([
        {
            id: 'internal-block-id',
            type: 'paragraph',
            props: { internalMetadata: 'do-not-index' },
            content: [{ type: 'text', text, styles: {} }],
            children: [],
        },
    ]);

test('builds embedding text from visible note content without internal JSON metadata', () => {
    const [chunk] = buildNoteEmbeddingChunks({
        id: 7,
        title: 'A story about death',
        content: paragraphContent('A fortune teller said I would die within six years.'),
    });

    assert.equal(chunk.noteId, 7);
    assert.equal(chunk.chunkIndex, 0);
    assert.equal(
        chunk.text,
        'Title: A story about death\nContent: A fortune teller said I would die within six years.',
    );
    assert.doesNotMatch(chunk.text, /internal-block-id|internalMetadata|do-not-index/);
    assert.match(chunk.sourceHash, /^[a-f0-9]{64}$/);
});

test('splits long note text into overlapping deterministic windows', () => {
    const text = Array.from({ length: 80 }, (_, index) => `sentence${index}`).join(' ');
    const chunks = splitSearchText(text, { maxLength: 100, overlap: 20 });

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.length <= 100));
    assert.equal(chunks.join('|'), splitSearchText(text, { maxLength: 100, overlap: 20 }).join('|'));

    const firstWords = chunks[0].split(' ');
    assert.ok(chunks[1].includes(firstWords.at(-1) ?? 'not-found'));
});

test('indexes a title-only note instead of dropping it', () => {
    const chunks = buildNoteEmbeddingChunks({ id: 3, title: 'A title-only note', content: '[]' });

    assert.deepEqual(
        chunks.map(({ noteId, chunkIndex, text }) => ({ noteId, chunkIndex, text })),
        [{ noteId: 3, chunkIndex: 0, text: 'Title: A title-only note\nContent:' }],
    );
});
