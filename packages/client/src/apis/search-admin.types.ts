export interface SemanticSearchConfig {
    enabled: boolean;
    baseUrl: string;
    model: string;
    /** Wraps the search query. Must contain `{query}`. */
    queryTemplate: string;
    /** Wraps each chunk of a titled note. Must contain `{content}`. Changing it requires rebuilding the index. */
    documentTemplate: string;
    /** Appended to every query and note chunk. Changing it requires rebuilding the index. */
    inputSuffix: string;
}

export interface SemanticSearchConfigInput extends SemanticSearchConfig {
    apiKey?: string | null;
}

export interface SemanticSearchModelsInput {
    baseUrl: string;
    apiKey?: string | null;
}

export type SemanticSearchPhase = 'disabled' | 'needs-connection' | 'needs-index' | 'indexing' | 'ready' | 'error';

export interface SemanticSearchBuildProgress {
    processedChunks: number;
    totalChunks: number;
}

export interface SearchAdminStatus {
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
    progress: SemanticSearchBuildProgress | null;
    error: string | null;
}

export interface SemanticSearchConnectionResult {
    ok: true;
    dimensions: number;
    model: string;
}

export interface EmbeddingModelDescriptor {
    id: string;
    likelyEmbedding: boolean;
}

export interface SemanticSearchModelsResult {
    models: EmbeddingModelDescriptor[];
}

export interface SemanticSearchReindexResult {
    started: boolean;
    status: SearchAdminStatus;
}
