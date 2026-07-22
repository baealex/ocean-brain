import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmbeddingClient } from './embedding-client.js';
import {
    DEFAULT_SEMANTIC_SEARCH_CONFIG,
    type SemanticSearchConfig,
    SemanticSearchConfigStore,
} from './search-config.js';
import { SemanticSearchManager } from './search-manager.js';
import type { SemanticVectorIndex } from './semantic-indexer.js';
import type { IndexedNoteChunk, SemanticIndexProfile } from './sqlite-vector-index.js';

const createManagerFixture = () => {
    let storedConfig: SemanticSearchConfig = DEFAULT_SEMANTIC_SEARCH_CONFIG;
    let profile: SemanticIndexProfile | null = null;
    let chunks: IndexedNoteChunk[] = [];
    let releaseEmbedding: (() => void) | null = null;
    let blockEmbedding = false;

    const configStore = new SemanticSearchConfigStore({
        async findUnique() {
            return { value: JSON.stringify(storedConfig) };
        },
        async upsert({ create, update }) {
            storedConfig = JSON.parse(storedConfig === DEFAULT_SEMANTIC_SEARCH_CONFIG ? create.value : update.value);
        },
    });
    const vectorIndex: SemanticVectorIndex = {
        async clear() {
            profile = null;
            chunks = [];
        },
        async getStatus() {
            return {
                ready: Boolean(profile && chunks.length > 0),
                profile,
                noteCount: new Set(chunks.map((chunk) => chunk.noteId)).size,
                chunkCount: chunks.length,
                indexedAt: profile ? '2026-07-21T00:00:00.000Z' : null,
            };
        },
        async replaceAll(nextProfile, nextChunks) {
            profile = nextProfile;
            chunks = nextChunks;
            return this.getStatus();
        },
        async search() {
            return [{ noteId: 1, distance: 0.1 }];
        },
    };
    const embeddingClient: EmbeddingClient = {
        async embedDocuments(texts) {
            if (blockEmbedding) {
                await new Promise<void>((resolve) => {
                    releaseEmbedding = resolve;
                });
            }
            return texts.map(() => [1, 0]);
        },
        async embedQuery() {
            return [1, 0];
        },
    };
    const manager = new SemanticSearchManager({
        configStore,
        vectorIndex,
        listNotes: async () => [
            {
                id: 1,
                title: '예언',
                content: JSON.stringify([
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '6년 안에 죽는다는 이야기', styles: {} }],
                    },
                ]),
            },
        ],
        createEmbeddingClient: () => embeddingClient,
    });

    return {
        manager,
        setBlockEmbedding(value: boolean) {
            blockEmbedding = value;
        },
        releaseEmbedding() {
            releaseEmbedding?.();
        },
    };
};

const enabledConfig: SemanticSearchConfig = {
    enabled: true,
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: 'qwen-embedding',
    queryInstruction: 'Retrieve relevant notes.',
};

test('marks a saved embedding configuration as needing an index', async () => {
    const { manager } = createManagerFixture();

    const status = await manager.saveConfig(enabledConfig);

    assert.equal(status.phase, 'needs-index');
    assert.equal(status.available, false);
    assert.equal(status.needsReindex, true);
});

test('builds an index in the background and enables semantic queries when complete', async () => {
    const { manager } = createManagerFixture();
    await manager.saveConfig(enabledConfig);

    const started = await manager.startReindex();
    const completed = await manager.waitForActiveReindex();
    const search = await manager.trySearch('점쟁이 죽는', 10);

    assert.equal(started.started, true);
    assert.equal(completed.phase, 'ready');
    assert.equal(completed.noteCount, 1);
    assert.equal(completed.dimensions, 2);
    assert.deepEqual(search.matches, [{ noteId: 1, distance: 0.1 }]);
});

test('changing only the optional query instruction keeps the document index usable', async () => {
    const { manager } = createManagerFixture();
    await manager.saveConfig(enabledConfig);
    await manager.startReindex();
    await manager.waitForActiveReindex();

    const status = await manager.saveConfig({
        ...enabledConfig,
        queryInstruction: 'Find a related personal memory.',
    });

    assert.equal(status.phase, 'ready');
    assert.equal(status.available, true);
    assert.equal(status.needsReindex, false);
});

test('does not allow embedding settings to change during a running rebuild', async () => {
    const { manager, releaseEmbedding, setBlockEmbedding } = createManagerFixture();
    await manager.saveConfig(enabledConfig);
    setBlockEmbedding(true);

    await manager.startReindex();
    await assert.rejects(manager.saveConfig({ ...enabledConfig, model: 'other-model' }), /while indexing/);

    releaseEmbedding();
    await manager.waitForActiveReindex();
});
