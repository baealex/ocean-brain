import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import { normalizeEmbeddingApiKey } from '../embedding-api-key-store.js';
import { type EmbeddingModelDescriptor, normalizeEmbeddingModelsUrl } from '../embedding-client.js';
import { normalizeSemanticSearchConfig, type SemanticSearchConfig } from '../search-config.js';
import {
    type EmbeddingApiKeyInput,
    getDefaultSemanticSearchManager,
    type SemanticSearchManager,
} from '../search-manager.js';
import { stripTrailingSlashes } from '../url-normalization.js';

type SearchAdminManager = Pick<SemanticSearchManager, 'getStatus' | 'saveConfig' | 'testConnection' | 'startReindex'>;
type ListEmbeddingModels = (baseUrl: string, apiKeyInput: EmbeddingApiKeyInput) => Promise<EmbeddingModelDescriptor[]>;

const parseApiKeyInput = (value: unknown): EmbeddingApiKeyInput => {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'apiKey')) {
        return { provided: false };
    }

    const rawApiKey = (value as { apiKey?: unknown }).apiKey;
    if (rawApiKey !== null && typeof rawApiKey !== 'string') {
        throw createAppError(400, 'INVALID_EMBEDDING_API_KEY', 'Embedding API key must be a string or null.');
    }

    try {
        return {
            provided: true,
            apiKey: rawApiKey === null ? undefined : normalizeEmbeddingApiKey(rawApiKey),
        };
    } catch (error) {
        throw createAppError(
            400,
            'INVALID_EMBEDDING_API_KEY',
            error instanceof Error ? error.message : 'Embedding API key is invalid.',
        );
    }
};

const parseConfig = (value: unknown): SemanticSearchConfig => {
    if (!value || typeof value !== 'object') {
        throw createAppError(400, 'INVALID_SEARCH_CONFIG', 'Semantic search settings must be an object.');
    }

    const config = value as Partial<SemanticSearchConfig>;
    if (
        typeof config.enabled !== 'boolean' ||
        typeof config.baseUrl !== 'string' ||
        typeof config.model !== 'string' ||
        typeof config.queryInstruction !== 'string'
    ) {
        throw createAppError(
            400,
            'INVALID_SEARCH_CONFIG',
            'enabled, baseUrl, model, and queryInstruction are required.',
        );
    }

    try {
        return normalizeSemanticSearchConfig(config as SemanticSearchConfig);
    } catch (error) {
        throw createAppError(
            400,
            'INVALID_SEARCH_CONFIG',
            error instanceof Error ? error.message : 'Semantic search settings are invalid.',
        );
    }
};

const parseBaseUrl = (value: unknown) => {
    if (!value || typeof value !== 'object' || typeof (value as { baseUrl?: unknown }).baseUrl !== 'string') {
        throw createAppError(400, 'INVALID_EMBEDDING_API_URL', 'Embedding API URL is required.');
    }

    const inputBaseUrl = (value as { baseUrl: string }).baseUrl;
    if (inputBaseUrl.length > 2_048) {
        throw createAppError(400, 'INVALID_EMBEDDING_API_URL', 'Embedding API URL is too long.');
    }
    const baseUrl = stripTrailingSlashes(inputBaseUrl.trim());
    try {
        normalizeEmbeddingModelsUrl(baseUrl);
    } catch (error) {
        throw createAppError(
            400,
            'INVALID_EMBEDDING_API_URL',
            error instanceof Error ? error.message : 'Embedding API URL is invalid.',
        );
    }

    return baseUrl;
};

export const createSearchAdminStatusHandler = (
    manager: SearchAdminManager = getDefaultSemanticSearchManager(),
): Controller => {
    return async (_req, res) => {
        res.status(200)
            .json(await manager.getStatus())
            .end();
    };
};

export const createSearchAdminSaveConfigHandler = (
    manager: SearchAdminManager = getDefaultSemanticSearchManager(),
): Controller => {
    return async (req, res) => {
        const status = await manager.saveConfig(parseConfig(req.body), parseApiKeyInput(req.body));
        res.status(200).json(status).end();
    };
};

export const createSearchAdminTestConnectionHandler = (
    manager: SearchAdminManager = getDefaultSemanticSearchManager(),
): Controller => {
    return async (req, res) => {
        const config = parseConfig({ ...req.body, enabled: true });
        const result = await manager.testConnection(config, parseApiKeyInput(req.body));
        res.status(200).json(result).end();
    };
};

export const createSearchAdminListModelsHandler = (
    listModels: ListEmbeddingModels = (baseUrl, apiKeyInput) =>
        getDefaultSemanticSearchManager().listModels(baseUrl, apiKeyInput),
): Controller => {
    return async (req, res) => {
        const models = await listModels(parseBaseUrl(req.body), parseApiKeyInput(req.body));
        res.status(200).json({ models }).end();
    };
};

export const createSearchAdminReindexHandler = (
    manager: SearchAdminManager = getDefaultSemanticSearchManager(),
): Controller => {
    return async (_req, res) => {
        const result = await manager.startReindex();
        res.status(result.started ? 202 : 200)
            .json(result)
            .end();
    };
};
