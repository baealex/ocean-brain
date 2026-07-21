import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import { normalizeSemanticSearchConfig, type SemanticSearchConfig } from '../search-config.js';
import { getDefaultSemanticSearchManager, type SemanticSearchManager } from '../search-manager.js';

type SearchAdminManager = Pick<SemanticSearchManager, 'getStatus' | 'saveConfig' | 'testConnection' | 'startReindex'>;

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
        const status = await manager.saveConfig(parseConfig(req.body));
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
