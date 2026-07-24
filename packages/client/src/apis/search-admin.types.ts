export interface SemanticSearchConfig {
    enabled: boolean;
    baseUrl: string;
    model: string;
    queryInstruction: string;
}

export type SemanticSearchPhase = 'disabled' | 'needs-index' | 'indexing' | 'ready' | 'error';

export interface SemanticSearchBuildProgress {
    processedChunks: number;
    totalChunks: number;
}

export interface SearchAdminStatus {
    config: SemanticSearchConfig;
    connectionValidated: boolean;
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
