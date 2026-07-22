export interface EmbeddingProviderConfig {
    baseUrl: string;
    model: string;
    apiKey?: string;
    queryInstruction?: string;
}

export interface EmbeddingClient {
    embedDocuments: (texts: string[]) => Promise<number[][]>;
    embedQuery: (query: string) => Promise<number[]>;
}

interface EmbeddingClientOptions {
    fetch?: typeof fetch;
    timeoutMs?: number;
}

export interface EmbeddingModelDescriptor {
    id: string;
    likelyEmbedding: boolean;
}

interface EmbeddingResponseItem {
    embedding?: unknown;
    index?: unknown;
}

const DEFAULT_EMBEDDING_TIMEOUT_MS = 60_000;
const DEFAULT_MODEL_DISCOVERY_TIMEOUT_MS = 10_000;

const buildOpenAiCompatibleUrl = (baseUrl: string, resource: 'embeddings' | 'models') => {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(baseUrl);
    } catch {
        throw new Error('Embedding API URL must be a valid http or https URL.');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Embedding API URL must use http or https.');
    }

    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '');
    const basePath = normalizedPath.replace(/\/(?:embeddings|models)$/i, '');
    parsedUrl.pathname = `${basePath || '/v1'}/${resource}`;
    parsedUrl.search = '';
    parsedUrl.hash = '';

    return parsedUrl.toString();
};

const buildEmbeddingsUrl = (baseUrl: string) => buildOpenAiCompatibleUrl(baseUrl, 'embeddings');
const buildModelsUrl = (baseUrl: string) => buildOpenAiCompatibleUrl(baseUrl, 'models');

const validateEmbedding = (value: unknown, expectedIndex: number) => {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`Embedding API returned an empty vector for input ${expectedIndex}.`);
    }

    const embedding = value.map((item) => {
        if (typeof item !== 'number' || !Number.isFinite(item)) {
            throw new Error(`Embedding API returned an invalid vector value for input ${expectedIndex}.`);
        }

        return item;
    });

    return embedding;
};

const parseEmbeddingResponse = (payload: unknown, expectedCount: number) => {
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
        throw new Error('Embedding API response does not contain a data array.');
    }

    const items = payload.data as EmbeddingResponseItem[];
    if (items.length !== expectedCount) {
        throw new Error(`Embedding API returned ${items.length} vectors for ${expectedCount} inputs.`);
    }

    const orderedItems = [...items].sort((left, right) => {
        const leftIndex = typeof left.index === 'number' ? left.index : items.indexOf(left);
        const rightIndex = typeof right.index === 'number' ? right.index : items.indexOf(right);
        return leftIndex - rightIndex;
    });
    const embeddings = orderedItems.map((item, index) => validateEmbedding(item.embedding, index));
    const dimensions = embeddings[0]?.length;

    if (!dimensions || embeddings.some((embedding) => embedding.length !== dimensions)) {
        throw new Error('Embedding API returned vectors with inconsistent dimensions.');
    }

    return embeddings;
};

const readApiErrorMessage = async (response: Response) => {
    try {
        const payload = (await response.json()) as { error?: { message?: unknown }; message?: unknown };
        const message = payload.error?.message ?? payload.message;
        return typeof message === 'string' && message.trim() ? message.trim() : undefined;
    } catch {
        return undefined;
    }
};

const looksLikeEmbeddingModel = (modelId: string) => /(^|[-_/])(embed|embedding|bge|e5|gte)([-_/.]|$)/i.test(modelId);

export const listOpenAiCompatibleEmbeddingModels = async (
    baseUrl: string,
    options: EmbeddingClientOptions = {},
): Promise<EmbeddingModelDescriptor[]> => {
    const endpoint = buildModelsUrl(baseUrl);
    const fetchImpl = options.fetch ?? fetch;
    const timeoutMs = options.timeoutMs ?? DEFAULT_MODEL_DISCOVERY_TIMEOUT_MS;
    const response = await fetchImpl(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
        const apiMessage = await readApiErrorMessage(response);
        throw new Error(
            apiMessage
                ? `Model discovery failed (${response.status}): ${apiMessage}`
                : `Model discovery failed with status ${response.status}.`,
        );
    }

    const payload = (await response.json()) as { data?: unknown };
    if (!Array.isArray(payload.data)) {
        throw new Error('Model discovery response does not contain a data array.');
    }

    const modelIds = [
        ...new Set(
            payload.data
                .map((item) => {
                    if (!item || typeof item !== 'object') return '';
                    const id = (item as { id?: unknown }).id;
                    return typeof id === 'string' ? id.trim() : '';
                })
                .filter(Boolean),
        ),
    ];

    if (modelIds.length === 0) {
        throw new Error('The API returned no models.');
    }

    return modelIds
        .map((id) => ({ id, likelyEmbedding: looksLikeEmbeddingModel(id) }))
        .sort((left, right) => {
            if (left.likelyEmbedding !== right.likelyEmbedding) {
                return left.likelyEmbedding ? -1 : 1;
            }
            return left.id.localeCompare(right.id);
        });
};

const buildQueryInput = (query: string, instruction?: string) => {
    const normalizedInstruction = instruction?.trim();
    if (!normalizedInstruction) {
        return query;
    }

    return `Instruct: ${normalizedInstruction}\nQuery: ${query}`;
};

export const createOpenAiCompatibleEmbeddingClient = (
    config: EmbeddingProviderConfig,
    options: EmbeddingClientOptions = {},
): EmbeddingClient => {
    const endpoint = buildEmbeddingsUrl(config.baseUrl);
    const model = config.model.trim();
    const fetchImpl = options.fetch ?? fetch;
    const timeoutMs = options.timeoutMs ?? DEFAULT_EMBEDDING_TIMEOUT_MS;

    if (!model) {
        throw new Error('Embedding model is required.');
    }

    const embed = async (inputs: string[]) => {
        if (inputs.length === 0) {
            return [];
        }

        const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
            },
            body: JSON.stringify({
                model,
                input: inputs,
                encoding_format: 'float',
            }),
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
            const apiMessage = await readApiErrorMessage(response);
            throw new Error(
                apiMessage
                    ? `Embedding API request failed (${response.status}): ${apiMessage}`
                    : `Embedding API request failed with status ${response.status}.`,
            );
        }

        return parseEmbeddingResponse(await response.json(), inputs.length);
    };

    return {
        embedDocuments: embed,
        async embedQuery(query) {
            const normalizedQuery = query.trim();
            if (!normalizedQuery) {
                throw new Error('Embedding query must not be empty.');
            }

            const [embedding] = await embed([buildQueryInput(normalizedQuery, config.queryInstruction)]);
            return embedding;
        },
    };
};

export const normalizeEmbeddingApiUrl = buildEmbeddingsUrl;
export const normalizeEmbeddingModelsUrl = buildModelsUrl;
