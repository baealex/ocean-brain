import { normalizeEmbeddingApiUrl } from './embedding-client.js';
import { DEFAULT_EMBEDDING_INPUT_FORMAT, type EmbeddingInputFormat } from './embedding-input-format.js';
import { stripTrailingSlashes } from './url-normalization.js';

export const SEMANTIC_SEARCH_CONFIG_CACHE_KEY = 'SEMANTIC_SEARCH_CONFIG_V1';
export const SEMANTIC_SEARCH_VALIDATED_CONNECTION_CACHE_KEY = 'SEMANTIC_SEARCH_VALIDATED_CONNECTION_V1';
const LEGACY_KOREAN_QUERY_INSTRUCTION =
    'Given a vague Korean memory query, retrieve relevant passages from personal notes.';

export interface SemanticSearchConfig extends EmbeddingInputFormat {
    enabled: boolean;
    baseUrl: string;
    model: string;
}

export interface ValidatedSemanticSearchConnection {
    baseUrl: string;
    model: string;
    validatedAt: string;
    authFingerprint: string;
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
    ...DEFAULT_EMBEDDING_INPUT_FORMAT,
};

const MAX_TEMPLATE_LENGTH = 1_000;
const MAX_INPUT_SUFFIX_LENGTH = 200;

/** Settings saved before input formats existed stored only an optional Qwen3-style query instruction. */
const queryTemplateFromInstruction = (instruction: unknown) => {
    const trimmed = typeof instruction === 'string' ? instruction.trim() : '';
    if (!trimmed || trimmed === LEGACY_KOREAN_QUERY_INSTRUCTION) {
        return DEFAULT_EMBEDDING_INPUT_FORMAT.queryTemplate;
    }
    return `Instruct: ${trimmed}\nQuery: {query}`;
};

const parseStoredConfig = (value: string): SemanticSearchConfig | null => {
    try {
        const parsed = JSON.parse(value) as Partial<SemanticSearchConfig> & { queryInstruction?: unknown };
        if (
            typeof parsed.enabled !== 'boolean' ||
            typeof parsed.baseUrl !== 'string' ||
            typeof parsed.model !== 'string'
        ) {
            return null;
        }

        return {
            enabled: parsed.enabled,
            baseUrl: parsed.baseUrl,
            model: parsed.model,
            queryTemplate:
                typeof parsed.queryTemplate === 'string'
                    ? parsed.queryTemplate
                    : queryTemplateFromInstruction(parsed.queryInstruction),
            documentTemplate:
                typeof parsed.documentTemplate === 'string'
                    ? parsed.documentTemplate
                    : DEFAULT_EMBEDDING_INPUT_FORMAT.documentTemplate,
            inputSuffix:
                typeof parsed.inputSuffix === 'string'
                    ? parsed.inputSuffix
                    : DEFAULT_EMBEDDING_INPUT_FORMAT.inputSuffix,
        };
    } catch {
        return null;
    }
};

const readStoredAuthFingerprint = ({
    authFingerprint,
    usesBearerAuth,
}: {
    authFingerprint?: unknown;
    usesBearerAuth?: unknown;
}) => {
    if (typeof authFingerprint === 'string') {
        return authFingerprint;
    }
    if (usesBearerAuth === false) {
        return '';
    }
    return 'legacy-bearer-auth';
};

const parseValidatedConnection = (value: string): ValidatedSemanticSearchConnection | null => {
    try {
        const parsed = JSON.parse(value) as Partial<ValidatedSemanticSearchConnection> & {
            usesBearerAuth?: unknown;
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
            authFingerprint: readStoredAuthFingerprint(parsed),
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
        queryTemplate: input.queryTemplate.trim() || DEFAULT_EMBEDDING_INPUT_FORMAT.queryTemplate,
        documentTemplate: input.documentTemplate.trim() || DEFAULT_EMBEDDING_INPUT_FORMAT.documentTemplate,
        inputSuffix: input.inputSuffix.trim(),
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

    if (config.queryTemplate.length > MAX_TEMPLATE_LENGTH || config.documentTemplate.length > MAX_TEMPLATE_LENGTH) {
        throw new Error('Embedding input templates are too long.');
    }

    if (!config.queryTemplate.includes('{query}')) {
        throw new Error('The query template must include {query}.');
    }

    if (!config.documentTemplate.includes('{content}')) {
        throw new Error('The document template must include {content}.');
    }

    if (config.inputSuffix.length > MAX_INPUT_SUFFIX_LENGTH) {
        throw new Error('The input suffix is too long.');
    }

    return config;
};

export class SemanticSearchConfigStore {
    constructor(private readonly cache: SearchConfigCache) {}

    async get() {
        const row = await this.cache.findUnique({ where: { key: SEMANTIC_SEARCH_CONFIG_CACHE_KEY } });
        const config = row ? parseStoredConfig(row.value) : null;
        return config ?? DEFAULT_SEMANTIC_SEARCH_CONFIG;
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

    async isConnectionValidated(input: Pick<SemanticSearchConfig, 'baseUrl' | 'model'>, authFingerprint = '') {
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
                validated.authFingerprint === authFingerprint,
        );
    }

    async markConnectionValidated(input: Pick<SemanticSearchConfig, 'baseUrl' | 'model'>, authFingerprint = '') {
        const config = normalizeSemanticSearchConfig({
            ...DEFAULT_SEMANTIC_SEARCH_CONFIG,
            baseUrl: input.baseUrl,
            model: input.model,
        });
        const validated: ValidatedSemanticSearchConnection = {
            baseUrl: config.baseUrl,
            model: config.model,
            validatedAt: new Date().toISOString(),
            authFingerprint,
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
