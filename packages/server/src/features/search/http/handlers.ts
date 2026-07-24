import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import {
    type EmbeddingModelDescriptor,
    listOpenAiCompatibleEmbeddingModels,
    normalizeEmbeddingModelsUrl,
} from '../embedding-client.js';
import { resolveEmbeddingRuntimeConfig } from '../embedding-runtime-config.js';
import { normalizeSemanticSearchConfig, type SemanticSearchConfig } from '../search-config.js';
import {
    getDefaultSemanticSearchManager,
    SemanticSearchConnectionNotValidatedError,
    type SemanticSearchManager,
} from '../search-manager.js';
import { stripTrailingSlashes } from '../url-normalization.js';

type SearchAdminManager = Pick<SemanticSearchManager, 'getStatus' | 'saveConfig' | 'testConnection' | 'startReindex'>;
type ListEmbeddingModels = (baseUrl: string) => Promise<EmbeddingModelDescriptor[]>;

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
        let status;
        try {
            status = await manager.saveConfig(parseConfig(req.body));
        } catch (error) {
            if (error instanceof SemanticSearchConnectionNotValidatedError) {
                throw createAppError(409, 'SEARCH_CONNECTION_NOT_VALIDATED', error.message);
            }
            throw error;
        }
        res.status(200).json(status).end();
    };
};

export const createSearchAdminTestConnectionHandler = (
    manager: SearchAdminManager = getDefaultSemanticSearchManager(),
): Controller => {
    return async (req, res) => {
        const config = parseConfig({ ...req.body, enabled: true });
        const result = await manager.testConnection(config);
        res.status(200).json(result).end();
    };
};

export const createSearchAdminListModelsHandler = (
    listModels: ListEmbeddingModels = (baseUrl) => {
        const runtimeConfig = resolveEmbeddingRuntimeConfig();
        return listOpenAiCompatibleEmbeddingModels(baseUrl, {
            apiKey: runtimeConfig.apiKey,
            allowedOrigins: runtimeConfig.allowedOrigins,
        });
    },
): Controller => {
    return async (req, res) => {
        const models = await listModels(parseBaseUrl(req.body));
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
