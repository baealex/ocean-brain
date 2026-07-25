import models from '~/models.js';
import { subscribeServerEvents } from '~/modules/server-events.js';
import { paths } from '~/paths.js';
import {
    createEmbeddingApiKeyFingerprint,
    type EmbeddingApiKeyStore,
    FileEmbeddingApiKeyStore,
} from './embedding-api-key-store.js';
import {
    createOpenAiCompatibleEmbeddingClient,
    type EmbeddingClient,
    type EmbeddingModelDescriptor,
    type EmbeddingProviderConfig,
    listOpenAiCompatibleEmbeddingModels,
} from './embedding-client.js';
import { subscribeSemanticSearchNoteChanges } from './note-change.js';
import {
    buildNoteEmbeddingChunks,
    NOTE_EMBEDDING_TEXT_SCHEMA_VERSION,
    type SemanticSearchNoteInput,
} from './note-chunking.js';
import { type SemanticSearchConfig, SemanticSearchConfigStore } from './search-config.js';
import {
    buildSemanticSearchIndex,
    type SemanticIndexBuildProgress,
    type SemanticVectorIndex,
    searchSemanticIndex,
    updateSemanticSearchNotes,
} from './semantic-indexer.js';
import {
    type SemanticNoteSyncQueueEntry,
    type SemanticNoteSyncStore,
    type SemanticVectorMatch,
    SqliteSemanticVectorIndex,
} from './sqlite-vector-index.js';

export type SemanticSearchPhase = 'disabled' | 'needs-connection' | 'needs-index' | 'indexing' | 'ready' | 'error';

export interface SemanticSearchStatus {
    config: SemanticSearchConfig;
    connectionValidated: boolean;
    apiKeyConfigured: boolean;
    phase: SemanticSearchPhase;
    available: boolean;
    needsReindex: boolean;
    noteCount: number;
    chunkCount: number;
    indexedAt: string | null;
    dimensions: number | null;
    pendingNoteCount: number;
    lastSyncedAt: string | null;
    syncError: string | null;
    progress: SemanticIndexBuildProgress | null;
    error: string | null;
}

export interface EmbeddingApiKeyInput {
    provided: boolean;
    apiKey?: string;
}

interface SearchManagerDependencies {
    configStore: SemanticSearchConfigStore;
    vectorIndex: SemanticVectorIndex & SemanticNoteSyncStore;
    listNotes: () => Promise<SemanticSearchNoteInput[]>;
    findNotes: (noteIds: number[]) => Promise<SemanticSearchNoteInput[]>;
    apiKeyStore: EmbeddingApiKeyStore;
    createEmbeddingClient?: (config: EmbeddingProviderConfig) => EmbeddingClient;
    now?: () => number;
}

export interface SemanticSearchAttempt {
    available: boolean;
    used: boolean;
    matches: SemanticVectorMatch[];
    error: string | null;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown semantic search error');

const NOTE_SYNC_QUIET_PERIOD_MS = 10_000;
const NOTE_SYNC_MAX_WAIT_MS = 60_000;
const NOTE_SYNC_POLL_INTERVAL_MS = 5_000;
const NOTE_SYNC_RECONCILIATION_INTERVAL_MS = 5 * 60_000;
const NOTE_SYNC_BATCH_SIZE = 20;
const NOTE_SYNC_RETRY_BASE_MS = 15_000;
const NOTE_SYNC_RETRY_MAX_MS = 5 * 60_000;

const profileMatchesConfig = (
    profile: Awaited<ReturnType<SemanticVectorIndex['getStatus']>>['profile'],
    config: SemanticSearchConfig,
) => {
    return Boolean(
        profile &&
            profile.baseUrl === config.baseUrl &&
            profile.model === config.model &&
            profile.textSchemaVersion === NOTE_EMBEDDING_TEXT_SCHEMA_VERSION,
    );
};

export class SemanticSearchManager {
    private activeReindex: Promise<void> | null = null;
    private activeNoteSync: Promise<{ failed: boolean; processed: boolean }> | null = null;
    private activeReconciliation: Promise<void> | null = null;
    private noteSyncPollTimer: ReturnType<typeof setInterval> | null = null;
    private noteSyncReconciliationTimer: ReturnType<typeof setInterval> | null = null;
    private progress: SemanticIndexBuildProgress | null = null;
    private lastError: string | null = null;
    private lastQueueError: string | null = null;

    constructor(private readonly dependencies: SearchManagerDependencies) {}

    private resolveApiKey(input?: EmbeddingApiKeyInput) {
        return input?.provided ? input.apiKey : this.dependencies.apiKeyStore.get();
    }

    private createClient(config: SemanticSearchConfig, apiKeyInput?: EmbeddingApiKeyInput) {
        const factory = this.dependencies.createEmbeddingClient ?? createOpenAiCompatibleEmbeddingClient;
        return factory({
            ...config,
            apiKey: this.resolveApiKey(apiKeyInput),
        });
    }

    private getAuthFingerprint(apiKeyInput?: EmbeddingApiKeyInput) {
        return createEmbeddingApiKeyFingerprint(this.resolveApiKey(apiKeyInput));
    }

    private now() {
        return this.dependencies.now?.() ?? Date.now();
    }

    async getStatus(): Promise<SemanticSearchStatus> {
        const [config, indexStatus, noteSyncStatus] = await Promise.all([
            this.dependencies.configStore.get(),
            this.dependencies.vectorIndex.getStatus(),
            this.dependencies.vectorIndex.getNoteSyncQueueStatus(),
        ]);
        const connectionValidated = await this.dependencies.configStore.isConnectionValidated(
            config,
            this.getAuthFingerprint(),
        );
        const profileMatches = profileMatchesConfig(indexStatus.profile, config);
        const indexReady = indexStatus.ready && profileMatches;
        const available = config.enabled && connectionValidated && indexReady;
        const needsReindex = config.enabled && connectionValidated && !indexReady;

        let phase: SemanticSearchPhase;
        if (this.activeReindex) {
            phase = 'indexing';
        } else if (this.lastError) {
            phase = 'error';
        } else if (!config.enabled) {
            phase = 'disabled';
        } else if (!connectionValidated) {
            phase = 'needs-connection';
        } else if (available) {
            phase = 'ready';
        } else {
            phase = 'needs-index';
        }

        return {
            config,
            connectionValidated,
            apiKeyConfigured: Boolean(this.dependencies.apiKeyStore.get()),
            phase,
            available,
            needsReindex,
            noteCount: indexStatus.noteCount,
            chunkCount: indexStatus.chunkCount,
            indexedAt: indexStatus.indexedAt,
            dimensions: indexStatus.profile?.dimensions ?? null,
            pendingNoteCount: noteSyncStatus.pendingNoteCount,
            lastSyncedAt: noteSyncStatus.lastSyncedAt ?? indexStatus.indexedAt,
            syncError: noteSyncStatus.error ?? this.lastQueueError,
            progress: this.progress,
            error: this.lastError,
        };
    }

    async saveConfig(config: SemanticSearchConfig, apiKeyInput?: EmbeddingApiKeyInput) {
        if (this.activeReindex) {
            throw new Error('Semantic search settings cannot change while indexing is running.');
        }

        const nextApiKey = this.resolveApiKey(apiKeyInput);
        const apiKeyChanged = Boolean(apiKeyInput?.provided && nextApiKey !== this.dependencies.apiKeyStore.get());

        this.lastError = null;
        this.progress = null;
        if (apiKeyChanged) {
            this.dependencies.apiKeyStore.set(nextApiKey);
        }
        await this.dependencies.configStore.set(config);
        return this.getStatus();
    }

    private async validateConnection(config: SemanticSearchConfig, apiKeyInput?: EmbeddingApiKeyInput) {
        const client = this.createClient({ ...config, enabled: true }, apiKeyInput);
        const [embedding] = await client.embedDocuments(['Ocean Brain embedding connection test']);
        await this.dependencies.configStore.markConnectionValidated(config, this.getAuthFingerprint(apiKeyInput));
        return embedding;
    }

    async testConnection(configInput?: SemanticSearchConfig, apiKeyInput?: EmbeddingApiKeyInput) {
        const config = configInput ?? (await this.dependencies.configStore.get());
        const embedding = await this.validateConnection(config, apiKeyInput);

        return {
            ok: true as const,
            dimensions: embedding.length,
            model: config.model,
        };
    }

    async listModels(baseUrl: string, apiKeyInput?: EmbeddingApiKeyInput): Promise<EmbeddingModelDescriptor[]> {
        return listOpenAiCompatibleEmbeddingModels(baseUrl, {
            apiKey: this.resolveApiKey(apiKeyInput),
        });
    }

    async startReindex() {
        if (this.activeReindex) {
            return { started: false, status: await this.getStatus() };
        }
        if (this.activeNoteSync) {
            await this.activeNoteSync;
        }

        const config = await this.dependencies.configStore.get();
        if (!config.enabled) {
            throw new Error('Enable semantic search before building its index.');
        }

        const currentStatus = await this.getStatus();
        if (!currentStatus.needsReindex) {
            return { started: false, status: currentStatus };
        }

        this.lastError = null;
        this.progress = { processedChunks: 0, totalChunks: 0 };
        const run = async () => {
            const notes = await this.dependencies.listNotes();
            await buildSemanticSearchIndex({
                notes,
                embeddingClient: this.createClient(config),
                vectorIndex: this.dependencies.vectorIndex,
                model: config.model,
                baseUrl: config.baseUrl,
                queryInstruction: config.queryInstruction,
                onProgress: (progress) => {
                    this.progress = progress;
                },
            });
            await this.dependencies.vectorIndex.recordNoteSyncSuccess(this.now());
        };

        this.activeReindex = run()
            .then(() => {
                this.progress = null;
                this.lastError = null;
            })
            .catch((error) => {
                this.progress = null;
                this.lastError = errorMessage(error);
            })
            .finally(() => {
                this.activeReindex = null;
                void this.processNextNoteSyncBatch().catch((error) => {
                    this.lastQueueError = errorMessage(error);
                });
            });

        return { started: true, status: await this.getStatus() };
    }

    async waitForActiveReindex() {
        await this.activeReindex;
        return this.getStatus();
    }

    private getRetryAt(entries: SemanticNoteSyncQueueEntry[]) {
        const attemptCount = Math.max(0, ...entries.map((entry) => entry.attemptCount));
        const retryDelay = Math.min(NOTE_SYNC_RETRY_BASE_MS * 2 ** attemptCount, NOTE_SYNC_RETRY_MAX_MS);
        return this.now() + retryDelay;
    }

    private processNextNoteSyncBatch(force = false) {
        if (this.activeNoteSync) {
            return this.activeNoteSync;
        }

        const run = async () => {
            if (this.activeReindex) {
                if (!force) {
                    return { failed: false, processed: false };
                }
                await this.activeReindex;
            }

            const status = await this.getStatus();
            if (!status.config.enabled || !status.available) {
                return { failed: false, processed: false };
            }

            const entries = await this.dependencies.vectorIndex.listPendingNoteSyncs({
                now: this.now(),
                quietPeriodMs: NOTE_SYNC_QUIET_PERIOD_MS,
                maxWaitMs: NOTE_SYNC_MAX_WAIT_MS,
                limit: NOTE_SYNC_BATCH_SIZE,
                force,
            });
            if (entries.length === 0) {
                return { failed: false, processed: false };
            }

            try {
                const noteIds = entries.map((entry) => entry.noteId);
                const notes = await this.dependencies.findNotes(noteIds);
                const existingNoteIds = new Set(notes.map((note) => note.id));
                const removedNoteIds = noteIds.filter((noteId) => !existingNoteIds.has(noteId));

                await updateSemanticSearchNotes({
                    notes,
                    removedNoteIds,
                    embeddingClient: this.createClient(status.config),
                    vectorIndex: this.dependencies.vectorIndex,
                });
                await this.dependencies.vectorIndex.completeNoteSyncs(entries, this.now());
                this.lastQueueError = null;
                return { failed: false, processed: true };
            } catch (error) {
                const message = errorMessage(error);
                await this.dependencies.vectorIndex.failNoteSyncs(entries, message, this.getRetryAt(entries));
                this.lastQueueError = message;
                return { failed: true, processed: true };
            }
        };

        const activeNoteSync = run().finally(() => {
            if (this.activeNoteSync === activeNoteSync) {
                this.activeNoteSync = null;
            }
        });
        this.activeNoteSync = activeNoteSync;
        return activeNoteSync;
    }

    async scheduleNoteSync(noteId: number) {
        if (!Number.isInteger(noteId) || noteId <= 0) {
            return;
        }

        try {
            await this.dependencies.vectorIndex.enqueueNoteSync(noteId, this.now());
            this.lastQueueError = null;
        } catch (error) {
            this.lastQueueError = errorMessage(error);
            throw error;
        }
    }

    async waitForPendingNoteSync(): Promise<SemanticSearchStatus> {
        while ((await this.dependencies.vectorIndex.getNoteSyncQueueStatus()).pendingNoteCount > 0) {
            const result = await this.processNextNoteSyncBatch(true);
            if (!result.processed || result.failed) {
                break;
            }
        }
        return this.getStatus();
    }

    runNoteSyncReconciliation() {
        if (this.activeReconciliation) {
            return this.activeReconciliation;
        }

        const run = async () => {
            if (this.activeReindex) {
                return;
            }

            const status = await this.getStatus();
            if (!status.available) {
                return;
            }

            const [notes, indexedSourceHashes] = await Promise.all([
                this.dependencies.listNotes(),
                this.dependencies.vectorIndex.getAllNoteSourceHashes(),
            ]);
            const currentSourceHashes = new Map<number, string>();

            for (const note of notes) {
                const sourceHash = buildNoteEmbeddingChunks(note)[0]?.sourceHash;
                if (sourceHash) {
                    currentSourceHashes.set(note.id, sourceHash);
                }
            }

            const changedNoteIds = new Set<number>();
            for (const [noteId, sourceHash] of currentSourceHashes) {
                if (indexedSourceHashes.get(noteId) !== sourceHash) {
                    changedNoteIds.add(noteId);
                }
            }
            for (const noteId of indexedSourceHashes.keys()) {
                if (!currentSourceHashes.has(noteId)) {
                    changedNoteIds.add(noteId);
                }
            }

            const reconciledAt = this.now();
            for (const noteId of changedNoteIds) {
                await this.dependencies.vectorIndex.enqueueNoteSync(noteId, reconciledAt);
            }
            await this.dependencies.vectorIndex.recordNoteSyncReconciliation(reconciledAt);
            this.lastQueueError = null;
        };

        const activeReconciliation = run()
            .catch((error) => {
                this.lastQueueError = errorMessage(error);
            })
            .finally(() => {
                if (this.activeReconciliation === activeReconciliation) {
                    this.activeReconciliation = null;
                }
            });
        this.activeReconciliation = activeReconciliation;
        return activeReconciliation;
    }

    startBackgroundSync() {
        if (this.noteSyncPollTimer || this.noteSyncReconciliationTimer) {
            return;
        }

        const poll = () => {
            void this.processNextNoteSyncBatch().catch((error) => {
                this.lastQueueError = errorMessage(error);
            });
        };
        const reconcile = () => {
            void this.runNoteSyncReconciliation();
        };

        poll();
        reconcile();
        this.noteSyncPollTimer = setInterval(poll, NOTE_SYNC_POLL_INTERVAL_MS);
        this.noteSyncPollTimer.unref?.();
        this.noteSyncReconciliationTimer = setInterval(reconcile, NOTE_SYNC_RECONCILIATION_INTERVAL_MS);
        this.noteSyncReconciliationTimer.unref?.();
    }

    stopBackgroundSync() {
        if (this.noteSyncPollTimer) {
            clearInterval(this.noteSyncPollTimer);
            this.noteSyncPollTimer = null;
        }
        if (this.noteSyncReconciliationTimer) {
            clearInterval(this.noteSyncReconciliationTimer);
            this.noteSyncReconciliationTimer = null;
        }
    }

    async trySearch(query: string, limit: number): Promise<SemanticSearchAttempt> {
        const status = await this.getStatus();
        if (!status.available) {
            return {
                available: false,
                used: false,
                matches: [],
                error: status.error,
            };
        }

        try {
            const matches = await searchSemanticIndex(
                query,
                limit,
                this.createClient(status.config),
                this.dependencies.vectorIndex,
            );
            return {
                available: true,
                used: true,
                matches,
                error: null,
            };
        } catch (error) {
            return {
                available: true,
                used: false,
                matches: [],
                error: errorMessage(error),
            };
        }
    }
}

let defaultSemanticSearchManager: SemanticSearchManager | null = null;

export const getDefaultSemanticSearchManager = () => {
    if (!defaultSemanticSearchManager) {
        defaultSemanticSearchManager = new SemanticSearchManager({
            configStore: new SemanticSearchConfigStore({
                findUnique: (args) => models.cache.findUnique(args),
                upsert: (args) => models.cache.upsert(args),
            }),
            vectorIndex: new SqliteSemanticVectorIndex(paths.searchIndex),
            listNotes: () =>
                models.note.findMany({
                    orderBy: { id: 'asc' },
                    select: {
                        id: true,
                        title: true,
                        content: true,
                    },
                }),
            findNotes: (noteIds) =>
                models.note.findMany({
                    where: { id: { in: noteIds } },
                    select: {
                        id: true,
                        title: true,
                        content: true,
                    },
                }),
            apiKeyStore: new FileEmbeddingApiKeyStore(paths.embeddingApiKey),
        });
        subscribeServerEvents((event) => {
            void defaultSemanticSearchManager?.scheduleNoteSync(Number(event.noteId)).catch(() => undefined);
        });
        subscribeSemanticSearchNoteChanges((noteId) => {
            void defaultSemanticSearchManager?.scheduleNoteSync(noteId).catch(() => undefined);
        });
        defaultSemanticSearchManager.startBackgroundSync();
    }

    return defaultSemanticSearchManager;
};
