import type { Controller } from '~/types/index.js';
import { InvalidTagNameError, ensureTagByName } from '~/modules/tag-organization.js';

export const createMcpCreateTagHandler = (
    ensureTag = ensureTagByName
): Controller => {
    return async (req, res) => {
        const name = req.body?.name;

        if (typeof name !== 'string') {
            res.status(400).json({
                code: 'INVALID_TAG_NAME',
                message: 'A tag name is required.'
            }).end();
            return;
        }

        try {
            const result = await ensureTag(name);
            res.status(200).json(result).end();
        } catch (error) {
            if (error instanceof InvalidTagNameError) {
                res.status(400).json({
                    code: 'INVALID_TAG_NAME',
                    message: error.message
                }).end();
                return;
            }

            throw error;
        }
    };
};
