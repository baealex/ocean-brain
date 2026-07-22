import models from '~/models.js';
import { paths } from '~/paths.js';
import { createOpenAiCompatibleEmbeddingClient, type EmbeddingClient } from './embedding-client.js';
import { NOTE_EMBEDDING_TEXT_SCHEMA_VERSION, type SemanticSearchNoteInput } from './note-chunking.js';
import { type SemanticSearchConfig, SemanticSearchConfigStore } from './search-config.js';
import {
    buildSemanticSearchIndex,
    type SemanticIndexBuildProgress,
    type SemanticVectorIndex,
    searchSemanticIndex,
} from './semantic-indexer.js';
import { type SemanticVectorMatch, SqliteSemanticVectorIndex } from './sqlite-vector-index.js';

export type SemanticSearchPhase = 'disabled' | 'needs-index' | 'indexing' | 'ready' | 'error';

export interface SemanticSearchStatus {
    config: SemanticSearchConfig;
    phase: SemanticSearchPhase;
    available: boolean;
    needsReindex: boolean;
    noteCount: number;
    chunkCount: number;
    indexedAt: string | null;
    dimensions: number | null;
    progress: SemanticIndexBuildProgress | null;
    error: string | null;
}

interface SearchManagerDependencies {
    configStore: SemanticSearchConfigStore;
    vectorIndex: SemanticVectorIndex;
    listNotes: () => Promise<SemanticSearchNoteInput[]>;
    createEmbeddingClient?: (config: SemanticSearchConfig) => EmbeddingClient;
}

export interface SemanticSearchAttempt {
    available: boolean;
    used: boolean;
    matches: SemanticVectorMatch[];
    error: string | null;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown semantic search error');

const profileMatchesConfig = (
    profile: Awaited<ReturnType<SemanticVectorIndex['getStatus']>>['profile'],
    config: SemanticSearchConfig,
) => {
    return Boolean(
        profile && profile.model === config.model && profile.textSchemaVersion === NOTE_EMBEDDING_TEXT_SCHEMA_VERSION,
    );
};

export class SemanticSearchManager {
    private activeReindex: Promise<void> | null = null;
    private progress: SemanticIndexBuildProgress | null = null;
    private lastError: string | null = null;

    constructor(private readonly dependencies: SearchManagerDependencies) {}

    private createClient(config: SemanticSearchConfig) {
        const factory = this.dependencies.createEmbeddingClient ?? createOpenAiCompatibleEmbeddingClient;
        return factory(config);
    }

    async getStatus(): Promise<SemanticSearchStatus> {
        const [config, indexStatus] = await Promise.all([
            this.dependencies.configStore.get(),
            this.dependencies.vectorIndex.getStatus(),
        ]);
        const profileMatches = profileMatchesConfig(indexStatus.profile, config);
        const available = config.enabled && indexStatus.ready && profileMatches;
        const needsReindex = config.enabled && !available;

        let phase: SemanticSearchPhase;
        if (this.activeReindex) {
            phase = 'indexing';
        } else if (this.lastError) {
            phase = 'error';
        } else if (!config.enabled) {
            phase = 'disabled';
        } else if (available) {
            phase = 'ready';
        } else {
            phase = 'needs-index';
        }

        return {
            config,
            phase,
            available,
            needsReindex,
            noteCount: indexStatus.noteCount,
            chunkCount: indexStatus.chunkCount,
            indexedAt: indexStatus.indexedAt,
            dimensions: indexStatus.profile?.dimensions ?? null,
            progress: this.progress,
            error: this.lastError,
        };
    }

    async saveConfig(config: SemanticSearchConfig) {
        if (this.activeReindex) {
            throw new Error('Semantic search settings cannot change while indexing is running.');
        }

        this.lastError = null;
        this.progress = null;
        await this.dependencies.configStore.set(config);
        return this.getStatus();
    }

    async testConnection(configInput?: SemanticSearchConfig) {
        const config = configInput ?? (await this.dependencies.configStore.get());
        const client = this.createClient({ ...config, enabled: true });
        const [embedding] = await client.embedDocuments(['Ocean Brain embedding connection test']);

        return {
            ok: true as const,
            dimensions: embedding.length,
            model: config.model,
        };
    }

    async startReindex() {
        if (this.activeReindex) {
            return { started: false, status: await this.getStatus() };
        }

        const config = await this.dependencies.configStore.get();
        if (!config.enabled) {
            throw new Error('Enable semantic search before building its index.');
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
                queryInstruction: config.queryInstruction,
                onProgress: (progress) => {
                    this.progress = progress;
                },
            });
        };

        this.activeReindex = run()
            .then(() => {
                this.progress = null;
            })
            .catch((error) => {
                this.progress = null;
                this.lastError = errorMessage(error);
            })
            .finally(() => {
                this.activeReindex = null;
            });

        return { started: true, status: await this.getStatus() };
    }

    async waitForActiveReindex() {
        await this.activeReindex;
        return this.getStatus();
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
        });
    }

    return defaultSemanticSearchManager;
};
