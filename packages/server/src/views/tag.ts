import type { Controller } from '~/types/index.js';
import { createAppError } from '~/modules/error-handler.js';
import { InvalidTagNameError, ensureTagByName } from '~/modules/tag-organization.js';

export const createMcpCreateTagHandler = (
    ensureTag = ensureTagByName
): Controller => {
    return async (req, res) => {
        const name = req.body?.name;

        if (typeof name !== 'string') {
            throw createAppError(400, 'INVALID_TAG_NAME', 'A tag name is required.');
        }

        try {
            const result = await ensureTag(name);
            res.status(200).json(result).end();
        } catch (error) {
            if (error instanceof InvalidTagNameError) {
                throw createAppError(400, 'INVALID_TAG_NAME', error.message);
            }

            throw error;
        }
    };
};
