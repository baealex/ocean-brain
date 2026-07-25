import { normalizeEmbeddingApiUrl } from './embedding-client.js';
import { stripTrailingSlashes } from './url-normalization.js';

export const SEMANTIC_SEARCH_CONFIG_CACHE_KEY = 'SEMANTIC_SEARCH_CONFIG_V1';
export const SEMANTIC_SEARCH_VALIDATED_CONNECTION_CACHE_KEY = 'SEMANTIC_SEARCH_VALIDATED_CONNECTION_V1';
const LEGACY_KOREAN_QUERY_INSTRUCTION =
    'Given a vague Korean memory query, retrieve relevant passages from personal notes.';

export interface SemanticSearchConfig {
    enabled: boolean;
    baseUrl: string;
    model: string;
    queryInstruction: string;
}

export interface ValidatedSemanticSearchConnection {
    baseUrl: string;
    model: string;
    validatedAt: string;
    usesBearerAuth: boolean;
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

const parseValidatedConnection = (value: string): ValidatedSemanticSearchConnection | null => {
    try {
        const parsed = JSON.parse(value) as Partial<ValidatedSemanticSearchConnection> & {
            authFingerprint?: unknown;
        };
        if (
            typeof parsed.baseUrl !== 'string' ||
            typeof parsed.model !== 'string' ||
            typeof parsed.validatedAt !== 'string'
        ) {
            return null;
        }

        return {
            baseUrl: parsed.baseUrl,
            model: parsed.model,
            validatedAt: parsed.validatedAt,
            usesBearerAuth:
                typeof parsed.usesBearerAuth === 'boolean'
                    ? parsed.usesBearerAuth
                    : typeof parsed.authFingerprint === 'string' && parsed.authFingerprint.length > 0,
        };
    } catch {
        return null;
    }
};

export const normalizeSemanticSearchConfig = (input: SemanticSearchConfig): SemanticSearchConfig => {
    if (input.baseUrl.length > 2_048) {
        throw new Error('Embedding API URL is too long.');
    }

    const config = {
        enabled: input.enabled,
        baseUrl: stripTrailingSlashes(input.baseUrl.trim()),
        model: input.model.trim(),
        queryInstruction: input.queryInstruction.trim(),
    };

    if (config.baseUrl) {
        normalizeEmbeddingApiUrl(config.baseUrl);
    }

    if (config.enabled && (!config.baseUrl || !config.model)) {
        throw new Error('Embedding API URL and model are required when semantic search is enabled.');
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
        const config = row ? parseStoredConfig(row.value) : null;
        if (!config) {
            return DEFAULT_SEMANTIC_SEARCH_CONFIG;
        }

        if (config.queryInstruction.trim() === LEGACY_KOREAN_QUERY_INSTRUCTION) {
            return this.set({ ...config, queryInstruction: '' });
        }

        return config;
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

    async getValidatedConnection() {
        const row = await this.cache.findUnique({
            where: { key: SEMANTIC_SEARCH_VALIDATED_CONNECTION_CACHE_KEY },
        });
        return row ? parseValidatedConnection(row.value) : null;
    }

    async isConnectionValidated(input: Pick<SemanticSearchConfig, 'baseUrl' | 'model'>, usesBearerAuth = false) {
        const config = normalizeSemanticSearchConfig({
            ...DEFAULT_SEMANTIC_SEARCH_CONFIG,
            baseUrl: input.baseUrl,
            model: input.model,
        });
        const validated = await this.getValidatedConnection();
        return Boolean(
            validated &&
                validated.baseUrl === config.baseUrl &&
                validated.model === config.model &&
                validated.usesBearerAuth === usesBearerAuth,
        );
    }

    async markConnectionValidated(input: Pick<SemanticSearchConfig, 'baseUrl' | 'model'>, usesBearerAuth = false) {
        const config = normalizeSemanticSearchConfig({
            ...DEFAULT_SEMANTIC_SEARCH_CONFIG,
            baseUrl: input.baseUrl,
            model: input.model,
        });
        const validated: ValidatedSemanticSearchConnection = {
            baseUrl: config.baseUrl,
            model: config.model,
            validatedAt: new Date().toISOString(),
            usesBearerAuth,
        };
        const value = JSON.stringify(validated);

        await this.cache.upsert({
            where: { key: SEMANTIC_SEARCH_VALIDATED_CONNECTION_CACHE_KEY },
            create: { key: SEMANTIC_SEARCH_VALIDATED_CONNECTION_CACHE_KEY, value },
            update: { value },
        });

        return validated;
    }
}
