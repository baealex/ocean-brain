import { normalizeEmbeddingApiUrl } from './embedding-client.js';

export const SEMANTIC_SEARCH_CONFIG_CACHE_KEY = 'SEMANTIC_SEARCH_CONFIG_V1';

export interface SemanticSearchConfig {
    enabled: boolean;
    baseUrl: string;
    model: string;
    queryInstruction: string;
}

export interface SearchConfigCache {
    findUnique: (args: { where: { key: string } }) => Promise<{ value: string } | null>;
    upsert: (args: {
        where: { key: string };
        create: { key: string; value: string };
        update: { value: string };
    }) => Promise<unknown>;
}

export const DEFAULT_SEMANTIC_SEARCH_CONFIG: SemanticSearchConfig = {
    enabled: false,
    baseUrl: '',
    model: '',
    queryInstruction: '',
};

const parseStoredConfig = (value: string): SemanticSearchConfig | null => {
    try {
        const parsed = JSON.parse(value) as Partial<SemanticSearchConfig>;
        if (
            typeof parsed.enabled !== 'boolean' ||
            typeof parsed.baseUrl !== 'string' ||
            typeof parsed.model !== 'string' ||
            typeof parsed.queryInstruction !== 'string'
        ) {
            return null;
        }

        return {
            enabled: parsed.enabled,
            baseUrl: parsed.baseUrl,
            model: parsed.model,
            queryInstruction: parsed.queryInstruction,
        };
    } catch {
        return null;
    }
};

export const normalizeSemanticSearchConfig = (input: SemanticSearchConfig): SemanticSearchConfig => {
    const config = {
        enabled: input.enabled,
        baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
        model: input.model.trim(),
        queryInstruction: input.queryInstruction.trim(),
    };

    if (config.baseUrl) {
        normalizeEmbeddingApiUrl(config.baseUrl);
    }

    if (config.enabled && (!config.baseUrl || !config.model)) {
        throw new Error('Embedding API URL and model are required when semantic search is enabled.');
    }

    if (config.baseUrl.length > 2_048) {
        throw new Error('Embedding API URL is too long.');
    }

    if (config.model.length > 200) {
        throw new Error('Embedding model name is too long.');
    }

    if (config.queryInstruction.length > 1_000) {
        throw new Error('Embedding query instruction is too long.');
    }

    return config;
};

export class SemanticSearchConfigStore {
    constructor(private readonly cache: SearchConfigCache) {}

    async get() {
        const row = await this.cache.findUnique({ where: { key: SEMANTIC_SEARCH_CONFIG_CACHE_KEY } });
        return row ? (parseStoredConfig(row.value) ?? DEFAULT_SEMANTIC_SEARCH_CONFIG) : DEFAULT_SEMANTIC_SEARCH_CONFIG;
    }

    async set(input: SemanticSearchConfig) {
        const config = normalizeSemanticSearchConfig(input);
        const value = JSON.stringify(config);

        await this.cache.upsert({
            where: { key: SEMANTIC_SEARCH_CONFIG_CACHE_KEY },
            create: { key: SEMANTIC_SEARCH_CONFIG_CACHE_KEY, value },
            update: { value },
        });

        return config;
    }
}
