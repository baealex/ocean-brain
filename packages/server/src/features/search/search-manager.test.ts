import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmbeddingClient, EmbeddingProviderConfig } from './embedding-client.js';
import {
    DEFAULT_SEMANTIC_SEARCH_CONFIG,
    SEMANTIC_SEARCH_CONFIG_CACHE_KEY,
    type SemanticSearchConfig,
    SemanticSearchConfigStore,
} from './search-config.js';
import { SemanticSearchManager } from './search-manager.js';
import type { SemanticVectorIndex } from './semantic-indexer.js';
import type {
    IndexedNoteChunk,
    SemanticIndexProfile,
    SemanticNoteSyncQueueEntry,
    SemanticNoteSyncStore,
} from './sqlite-vector-index.js';

const createManagerFixture = (options: { embeddingApiKey?: string } = {}) => {
    const cacheValues = new Map<string, string>([
        [SEMANTIC_SEARCH_CONFIG_CACHE_KEY, JSON.stringify(DEFAULT_SEMANTIC_SEARCH_CONFIG)],
    ]);
    let profile: SemanticIndexProfile | null = null;
    let chunks: IndexedNoteChunk[] = [];
    let note: { id: number; title: string; content: string } | null = {
        id: 1,
        title: 'Prediction',
        content: JSON.stringify([
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A story about dying within six years', styles: {} }],
            },
        ]),
    };
    let releaseEmbedding: (() => void) | null = null;
    let blockEmbedding = false;
    let embeddingCallCount = 0;
    let embeddingError: Error | null = null;
    let lastEmbeddingProviderConfig: EmbeddingProviderConfig | null = null;
    let embeddingApiKey = options.embeddingApiKey;
    let now = Date.parse('2026-07-21T00:00:00.000Z');
    let lastSyncedAt: string | null = null;
    let lastReconciledAt: string | null = null;
    const queuedNotes = new Map<number, SemanticNoteSyncQueueEntry & { error: string | null; nextAttemptAt: number }>();

    const configStore = new SemanticSearchConfigStore({
        async findUnique({ where }) {
            const value = cacheValues.get(where.key);
            return value === undefined ? null : { value };
        },
        async upsert({ where, create, update }) {
            cacheValues.set(where.key, cacheValues.has(where.key) ? update.value : create.value);
        },
    });
    const vectorIndex: SemanticVectorIndex & SemanticNoteSyncStore = {
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
        async getNoteSourceHash(noteId) {
            return chunks.find((chunk) => chunk.noteId === noteId)?.sourceHash ?? null;
        },
        async getAllNoteSourceHashes() {
            return new Map(chunks.map((chunk) => [chunk.noteId, chunk.sourceHash] as const));
        },
        async removeNote(noteId) {
            chunks = chunks.filter((chunk) => chunk.noteId !== noteId);
            return this.getStatus();
        },
        async replaceAll(nextProfile, nextChunks) {
            profile = nextProfile;
            chunks = nextChunks;
            return this.getStatus();
        },
        async replaceNote(noteId, nextChunks) {
            chunks = [...chunks.filter((chunk) => chunk.noteId !== noteId), ...nextChunks];
            return this.getStatus();
        },
        async search() {
            return [{ noteId: 1, distance: 0.1 }];
        },
        async enqueueNoteSync(noteId, queuedAt) {
            const current = queuedNotes.get(noteId);
            queuedNotes.set(noteId, {
                noteId,
                version: (current?.version ?? 0) + 1,
                firstQueuedAt: current?.firstQueuedAt ?? queuedAt,
                lastQueuedAt: queuedAt,
                attemptCount: 0,
                nextAttemptAt: queuedAt,
                error: null,
            });
        },
        async listPendingNoteSyncs(options) {
            return [...queuedNotes.values()]
                .filter(
                    (entry) =>
                        options.force ||
                        (entry.nextAttemptAt <= options.now &&
                            (entry.lastQueuedAt <= options.now - options.quietPeriodMs ||
                                entry.firstQueuedAt <= options.now - options.maxWaitMs)),
                )
                .slice(0, options.limit);
        },
        async completeNoteSyncs(entries, completedAt) {
            for (const entry of entries) {
                if (queuedNotes.get(entry.noteId)?.version === entry.version) {
                    queuedNotes.delete(entry.noteId);
                }
            }
            lastSyncedAt = new Date(completedAt).toISOString();
        },
        async failNoteSyncs(entries, error, retryAt) {
            for (const entry of entries) {
                const current = queuedNotes.get(entry.noteId);
                if (current?.version === entry.version) {
                    queuedNotes.set(entry.noteId, {
                        ...current,
                        attemptCount: current.attemptCount + 1,
                        nextAttemptAt: retryAt,
                        error,
                    });
                }
            }
        },
        async recordNoteSyncSuccess(completedAt) {
            lastSyncedAt = new Date(completedAt).toISOString();
        },
        async recordNoteSyncReconciliation(reconciledAt) {
            lastReconciledAt = new Date(reconciledAt).toISOString();
        },
        async getNoteSyncQueueStatus() {
            const entries = [...queuedNotes.values()];
            return {
                pendingNoteCount: entries.length,
                oldestQueuedAt: entries.length
                    ? new Date(Math.min(...entries.map((entry) => entry.firstQueuedAt))).toISOString()
                    : null,
                lastSyncedAt,
                lastReconciledAt,
                error: entries.find((entry) => entry.error)?.error ?? null,
            };
        },
    };
    const embeddingClient: EmbeddingClient = {
        async embedDocuments(texts) {
            embeddingCallCount += 1;
            if (embeddingError) {
                throw embeddingError;
            }
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
        listNotes: async () => (note ? [note] : []),
        findNotes: async (noteIds) => (note && noteIds.includes(note.id) ? [note] : []),
        createEmbeddingClient: (config) => {
            lastEmbeddingProviderConfig = config;
            return embeddingClient;
        },
        apiKeyStore: {
            get() {
                return embeddingApiKey;
            },
            set(value) {
                embeddingApiKey = value;
            },
        },
        now: () => now,
    });

    return {
        manager,
        setBlockEmbedding(value: boolean) {
            blockEmbedding = value;
        },
        setEmbeddingError(error: Error | null) {
            embeddingError = error;
        },
        releaseEmbedding() {
            releaseEmbedding?.();
        },
        setNote(nextNote: typeof note) {
            note = nextNote;
        },
        setNow(nextNow: number) {
            now = nextNow;
        },
        getChunks() {
            return chunks;
        },
        getEmbeddingCallCount() {
            return embeddingCallCount;
        },
        getLastEmbeddingProviderConfig() {
            return lastEmbeddingProviderConfig;
        },
        setEmbeddingApiKey(value?: string) {
            embeddingApiKey = value;
        },
    };
};

const enabledConfig: SemanticSearchConfig = {
    enabled: true,
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: 'qwen-embedding',
    queryInstruction: 'Retrieve relevant notes.',
};

const validateAndSaveConfig = async (manager: SemanticSearchManager, config = enabledConfig) => {
    await manager.testConnection(config);
    return manager.saveConfig(config);
};

test('requires a successful connection test before first activation', async () => {
    const { manager } = createManagerFixture();

    await assert.rejects(manager.saveConfig(enabledConfig), /Test this embedding API/);
    const status = await validateAndSaveConfig(manager);

    assert.equal(status.phase, 'needs-index');
    assert.equal(status.connectionValidated, true);
    assert.equal(status.available, false);
    assert.equal(status.needsReindex, true);
});

test('uses a server-side API key without exposing it in search status', async () => {
    const { manager, getLastEmbeddingProviderConfig } = createManagerFixture({
        embeddingApiKey: 'provider-secret',
    });

    await manager.testConnection(enabledConfig);
    const status = await manager.saveConfig(enabledConfig);

    assert.equal(getLastEmbeddingProviderConfig()?.apiKey, 'provider-secret');
    assert.equal(status.apiKeyConfigured, true);
    assert.equal('apiKey' in status.config, false);
});

test('validates and persists an API key supplied with search settings', async () => {
    const { manager, getLastEmbeddingProviderConfig } = createManagerFixture();
    const apiKeyInput = { provided: true, apiKey: 'provider-secret' };

    await manager.testConnection(enabledConfig, apiKeyInput);
    const status = await manager.saveConfig(enabledConfig, apiKeyInput);

    assert.equal(getLastEmbeddingProviderConfig()?.apiKey, 'provider-secret');
    assert.equal(status.apiKeyConfigured, true);
});

test('requires another connection test after removing a server-side API key', async () => {
    const { manager, setEmbeddingApiKey } = createManagerFixture({
        embeddingApiKey: 'provider-secret',
    });
    await validateAndSaveConfig(manager);

    setEmbeddingApiKey();
    const status = await manager.getStatus();

    assert.equal(status.connectionValidated, false);
    assert.equal(status.phase, 'needs-connection');
    assert.equal(status.needsReindex, false);
    await assert.rejects(manager.saveConfig(enabledConfig), /Test this embedding API/);
});

test('builds an index in the background and enables semantic queries when complete', async () => {
    const { manager } = createManagerFixture();
    await validateAndSaveConfig(manager);

    const started = await manager.startReindex();
    const completed = await manager.waitForActiveReindex();
    const search = await manager.trySearch('fortune teller death', 10);

    assert.equal(started.started, true);
    assert.equal(completed.phase, 'ready');
    assert.equal(completed.noteCount, 1);
    assert.equal(completed.dimensions, 2);
    assert.deepEqual(search.matches, [{ noteId: 1, distance: 0.1 }]);
});

test('changing only the optional query instruction keeps the document index usable', async () => {
    const { manager } = createManagerFixture();
    await validateAndSaveConfig(manager);
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

test('reuses a previously validated connection after disabling it', async () => {
    const { manager } = createManagerFixture();
    await validateAndSaveConfig(manager);

    await manager.saveConfig({ ...enabledConfig, enabled: false });
    const status = await manager.saveConfig(enabledConfig);

    assert.equal(status.connectionValidated, true);
    assert.equal(status.phase, 'needs-index');
});

test('requires a rebuild when the embedding API changes under the same model name', async () => {
    const { manager } = createManagerFixture();
    await validateAndSaveConfig(manager);
    await manager.startReindex();
    await manager.waitForActiveReindex();
    const changedConfig = { ...enabledConfig, baseUrl: 'http://127.0.0.1:5678/v1' };

    await manager.testConnection(changedConfig);
    const status = await manager.saveConfig(changedConfig);

    assert.equal(status.phase, 'needs-index');
    assert.equal(status.available, false);
});

test('does not rebuild an index that is already up to date', async () => {
    const { manager } = createManagerFixture();
    await validateAndSaveConfig(manager);
    await manager.startReindex();
    await manager.waitForActiveReindex();

    const result = await manager.startReindex();

    assert.equal(result.started, false);
    assert.equal(result.status.needsReindex, false);
});

test('updates only changed note content after the initial index build', async () => {
    const { getChunks, getEmbeddingCallCount, manager, setNote } = createManagerFixture();
    await validateAndSaveConfig(manager);
    await manager.startReindex();
    await manager.waitForActiveReindex();
    const initialSourceHash = getChunks()[0]?.sourceHash;
    const callsBeforeUpdate = getEmbeddingCallCount();
    setNote({
        id: 1,
        title: 'Changed prediction',
        content: JSON.stringify([
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A newly saved story', styles: {} }],
            },
        ]),
    });

    await manager.scheduleNoteSync(1);
    const status = await manager.waitForPendingNoteSync();

    assert.notEqual(getChunks()[0]?.sourceHash, initialSourceHash);
    assert.equal(getEmbeddingCallCount(), callsBeforeUpdate + 1);
    assert.equal(status.needsReindex, false);
    assert.equal(status.phase, 'ready');

    await manager.scheduleNoteSync(1);
    await manager.waitForPendingNoteSync();
    assert.equal(getEmbeddingCallCount(), callsBeforeUpdate + 1);
});

test('reconciles a note change that was not delivered as an event', async () => {
    const { getEmbeddingCallCount, manager, setNote } = createManagerFixture();
    await validateAndSaveConfig(manager);
    await manager.startReindex();
    await manager.waitForActiveReindex();
    const callsBeforeUpdate = getEmbeddingCallCount();
    setNote({
        id: 1,
        title: 'Recovered update',
        content: JSON.stringify([
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'This change missed the live event.', styles: {} }],
            },
        ]),
    });

    await manager.runNoteSyncReconciliation();
    const queued = await manager.getStatus();
    const completed = await manager.waitForPendingNoteSync();

    assert.equal(queued.pendingNoteCount, 1);
    assert.equal(completed.pendingNoteCount, 0);
    assert.equal(getEmbeddingCallCount(), callsBeforeUpdate + 1);
});

test('keeps failed note synchronization queued for retry without disabling search', async () => {
    const { manager, setEmbeddingError, setNote } = createManagerFixture();
    await validateAndSaveConfig(manager);
    await manager.startReindex();
    await manager.waitForActiveReindex();
    setNote({
        id: 1,
        title: 'Retry this update',
        content: JSON.stringify([
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'The provider is temporarily unavailable.', styles: {} }],
            },
        ]),
    });
    setEmbeddingError(new Error('provider unavailable'));

    await manager.scheduleNoteSync(1);
    const status = await manager.waitForPendingNoteSync();

    assert.equal(status.available, true);
    assert.equal(status.phase, 'ready');
    assert.equal(status.needsReindex, false);
    assert.equal(status.pendingNoteCount, 1);
    assert.match(status.syncError ?? '', /provider unavailable/);
});

test('does not allow embedding settings to change during a running rebuild', async () => {
    const { manager, releaseEmbedding, setBlockEmbedding } = createManagerFixture();
    await validateAndSaveConfig(manager);
    setBlockEmbedding(true);

    await manager.startReindex();
    await assert.rejects(manager.saveConfig({ ...enabledConfig, model: 'other-model' }), /while indexing/);

    releaseEmbedding();
    await manager.waitForActiveReindex();
});
