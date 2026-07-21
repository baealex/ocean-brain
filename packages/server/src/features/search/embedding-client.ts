export const DEFAULT_QUERY_INSTRUCTION =
    'Given a vague Korean memory query, retrieve relevant passages from personal notes.';

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

interface EmbeddingResponseItem {
    embedding?: unknown;
    index?: unknown;
}

const DEFAULT_EMBEDDING_TIMEOUT_MS = 60_000;

const buildEmbeddingsUrl = (baseUrl: string) => {
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
    parsedUrl.pathname = normalizedPath.endsWith('/embeddings')
        ? normalizedPath
        : `${normalizedPath || '/v1'}/embeddings`;
    parsedUrl.search = '';
    parsedUrl.hash = '';

    return parsedUrl.toString();
};

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
