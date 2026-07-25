import type { SearchAdminStatus, SemanticSearchConfigInput, SemanticSearchModelsInput } from './search-admin.types';

const LOCAL_DEMO_ERROR = 'Semantic search requires a server-backed Ocean Brain instance.';

let status: SearchAdminStatus = {
    config: {
        enabled: false,
        baseUrl: '',
        model: '',
        queryInstruction: '',
    },
    connectionValidated: false,
    apiKeyConfigured: false,
    phase: 'disabled',
    available: false,
    needsReindex: false,
    noteCount: 0,
    chunkCount: 0,
    indexedAt: null,
    dimensions: null,
    pendingNoteCount: 0,
    lastSyncedAt: null,
    syncError: null,
    progress: null,
    error: null,
};

const cloneStatus = () => structuredClone(status);

export const fetchSearchAdminStatus = async () => cloneStatus();

export const saveSemanticSearchConfig = async (config: SemanticSearchConfigInput) => {
    if (config.enabled) {
        throw new Error(LOCAL_DEMO_ERROR);
    }

    status = {
        ...status,
        config: {
            enabled: config.enabled,
            baseUrl: config.baseUrl,
            model: config.model,
            queryInstruction: config.queryInstruction,
        },
        apiKeyConfigured: config.apiKey === undefined ? status.apiKeyConfigured : Boolean(config.apiKey),
        connectionValidated: false,
        phase: 'disabled',
        available: false,
        needsReindex: false,
        error: null,
    };
    return cloneStatus();
};

export const fetchSemanticSearchModels = async (_input: SemanticSearchModelsInput) => {
    throw new Error(LOCAL_DEMO_ERROR);
};

export const testSemanticSearchConnection = async (_config: SemanticSearchConfigInput) => {
    throw new Error(LOCAL_DEMO_ERROR);
};

export const startSemanticSearchReindex = async () => {
    throw new Error(LOCAL_DEMO_ERROR);
};
