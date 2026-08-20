import { ensureTagByName, InvalidTagNameError } from '~/features/tag/services/organization.js';
import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';

export const createMcpCreateTagHandler = (ensureTag = ensureTagByName): Controller => {
    return async (req, reply) => {
        const name = req.body?.name;

        if (typeof name !== 'string') {
            throw createAppError(400, 'INVALID_TAG_NAME', 'A tag name is required.');
        }

        try {
            const result = await ensureTag(name);
            return reply.status(200).send(result);
        } catch (error) {
            if (error instanceof InvalidTagNameError) {
                throw createAppError(400, 'INVALID_TAG_NAME', error.message);
            }

            throw error;
        }
    };
};
