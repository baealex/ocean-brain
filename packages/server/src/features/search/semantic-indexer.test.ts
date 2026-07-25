import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmbeddingClient } from './embedding-client.js';
import {
    buildSemanticSearchIndex,
    type SemanticVectorIndex,
    searchSemanticIndex,
    updateSemanticSearchNotes,
} from './semantic-indexer.js';
import type { IndexedNoteChunk, SemanticIndexProfile } from './sqlite-vector-index.js';

const noteContent = (text: string) =>
    JSON.stringify([
        {
            id: 'paragraph',
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text, styles: {} }],
            children: [],
        },
    ]);

const createFakeVectorIndex = () => {
    let replacement: { profile: SemanticIndexProfile; chunks: IndexedNoteChunk[] } | null = null;
    let ready = false;

    const vectorIndex: SemanticVectorIndex = {
        async clear() {
            replacement = null;
            ready = false;
        },
        async getStatus() {
            return {
                ready,
                profile: replacement?.profile ?? null,
                noteCount: replacement ? new Set(replacement.chunks.map((chunk) => chunk.noteId)).size : 0,
                chunkCount: replacement?.chunks.length ?? 0,
                indexedAt: ready ? '2026-07-21T00:00:00.000Z' : null,
            };
        },
        async getNoteSourceHash(noteId) {
            return replacement?.chunks.find((chunk) => chunk.noteId === noteId)?.sourceHash ?? null;
        },
        async getAllNoteSourceHashes() {
            return new Map(replacement?.chunks.map((chunk) => [chunk.noteId, chunk.sourceHash] as const) ?? []);
        },
        async removeNote(noteId) {
            if (replacement) {
                replacement.chunks = replacement.chunks.filter((chunk) => chunk.noteId !== noteId);
            }
            return this.getStatus();
        },
        async replaceAll(profile, chunks) {
            replacement = { profile, chunks };
            ready = chunks.length > 0;
            return this.getStatus();
        },
        async replaceNote(noteId, chunks) {
            if (!replacement) {
                throw new Error('missing index');
            }
            replacement.chunks = [...replacement.chunks.filter((chunk) => chunk.noteId !== noteId), ...chunks];
            return this.getStatus();
        },
        async search() {
            return [{ noteId: 7, distance: 0.2 }];
        },
    };

    return { vectorIndex, getReplacement: () => replacement };
};

test('embeds note chunks in batches and replaces the index only after every batch succeeds', async () => {
    const requestedBatches: string[][] = [];
    const embeddingClient: EmbeddingClient = {
        async embedDocuments(texts) {
            requestedBatches.push(texts);
            return texts.map((_text, index) => [1, index]);
        },
        async embedQuery() {
            return [1, 0];
        },
    };
    const { vectorIndex, getReplacement } = createFakeVectorIndex();
    const progress: Array<[number, number]> = [];

    await buildSemanticSearchIndex({
        notes: [
            { id: 1, title: 'First note', content: noteContent('First content') },
            { id: 2, title: 'Second note', content: noteContent('Second content') },
        ],
        embeddingClient,
        vectorIndex,
        model: 'qwen-embedding',
        baseUrl: 'http://127.0.0.1:1234/v1',
        queryInstruction: 'Retrieve relevant notes.',
        batchSize: 1,
        onProgress: ({ processedChunks, totalChunks }) => progress.push([processedChunks, totalChunks]),
    });

    assert.equal(requestedBatches.length, 2);
    assert.deepEqual(progress, [
        [0, 2],
        [1, 2],
        [2, 2],
    ]);
    assert.equal(getReplacement()?.profile.dimensions, 2);
    assert.equal(getReplacement()?.chunks.length, 2);
});

test('does not replace a usable index when embedding a later batch fails', async () => {
    let requestCount = 0;
    const embeddingClient: EmbeddingClient = {
        async embedDocuments(texts) {
            requestCount += 1;
            if (requestCount === 2) {
                throw new Error('provider unavailable');
            }
            return texts.map(() => [1, 0]);
        },
        async embedQuery() {
            return [1, 0];
        },
    };
    const { vectorIndex, getReplacement } = createFakeVectorIndex();

    await assert.rejects(
        buildSemanticSearchIndex({
            notes: [
                { id: 1, title: 'First note', content: noteContent('First content') },
                { id: 2, title: 'Second note', content: noteContent('Second content') },
            ],
            embeddingClient,
            vectorIndex,
            model: 'qwen-embedding',
            baseUrl: 'http://127.0.0.1:1234/v1',
            queryInstruction: 'Retrieve relevant notes.',
            batchSize: 1,
        }),
        /provider unavailable/,
    );

    assert.equal(getReplacement(), null);
});

test('embeds a query only when an index is ready', async () => {
    let queryCount = 0;
    const embeddingClient: EmbeddingClient = {
        async embedDocuments() {
            return [];
        },
        async embedQuery() {
            queryCount += 1;
            return [1, 0];
        },
    };
    const { vectorIndex } = createFakeVectorIndex();

    assert.deepEqual(await searchSemanticIndex('fortune teller death', 10, embeddingClient, vectorIndex), []);
    assert.equal(queryCount, 0);
});

test('embeds changed notes together while skipping content already in the index', async () => {
    const requestedBatches: string[][] = [];
    const embeddingClient: EmbeddingClient = {
        async embedDocuments(texts) {
            requestedBatches.push(texts);
            return texts.map(() => [1, 0]);
        },
        async embedQuery() {
            return [1, 0];
        },
    };
    const { vectorIndex, getReplacement } = createFakeVectorIndex();
    const unchangedNote = { id: 1, title: 'Unchanged', content: noteContent('Same content') };

    await buildSemanticSearchIndex({
        notes: [unchangedNote],
        embeddingClient,
        vectorIndex,
        model: 'qwen-embedding',
        baseUrl: 'http://127.0.0.1:1234/v1',
        queryInstruction: '',
    });
    requestedBatches.length = 0;

    await updateSemanticSearchNotes({
        notes: [
            unchangedNote,
            { id: 2, title: 'Second', content: noteContent('New content') },
            { id: 3, title: 'Third', content: noteContent('Another new content') },
        ],
        removedNoteIds: [],
        embeddingClient,
        vectorIndex,
    });

    assert.equal(requestedBatches.length, 1);
    assert.equal(requestedBatches[0]?.length, 2);
    assert.deepEqual(
        getReplacement()
            ?.chunks.map((chunk) => chunk.noteId)
            .sort((left, right) => left - right),
        [1, 2, 3],
    );
});
