import models from '~/models.js';

interface TagRecord {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

interface TagOrganizationDeps {
    createTag: (name: string) => Promise<TagRecord>;
    findTagByName: (name: string) => Promise<TagRecord | null>;
}

export interface TagOrganizationResult {
    created: boolean;
    normalizedName: string;
    tag: {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
    };
}

export class InvalidTagNameError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidTagNameError';
    }
}

export const normalizeTagName = (name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
        throw new InvalidTagNameError('A tag name is required.');
    }

    const normalizedName = trimmedName.startsWith('@') ? trimmedName : `@${trimmedName}`;

    if (normalizedName === '@' || /\s/.test(normalizedName.slice(1))) {
        throw new InvalidTagNameError('Tag names must be a single token like @project.');
    }

    return normalizedName;
};

const serializeTag = (tag: TagRecord) => ({
    id: String(tag.id),
    name: tag.name,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
});

const isTagNameUniqueConflict = (error: unknown) => {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return false;
    }

    if (error.code !== 'P2002') {
        return false;
    }

    if (!('meta' in error) || typeof error.meta !== 'object' || error.meta === null) {
        return true;
    }

    const rawTarget = 'target' in error.meta ? error.meta.target : null;
    const targets = Array.isArray(rawTarget)
        ? rawTarget.filter((value): value is string => typeof value === 'string')
        : typeof rawTarget === 'string'
          ? [rawTarget]
          : [];

    return targets.length === 0 || targets.includes('name');
};

export const createTagOrganizationService = (deps: TagOrganizationDeps) => {
    return {
        ensureTag: async (name: string): Promise<TagOrganizationResult> => {
            const normalizedName = normalizeTagName(name);
            const existingTag = await deps.findTagByName(normalizedName);

            if (existingTag) {
                return {
                    created: false,
                    normalizedName,
                    tag: serializeTag(existingTag),
                };
            }

            let createdTag: TagRecord;

            try {
                createdTag = await deps.createTag(normalizedName);
            } catch (error) {
                if (!isTagNameUniqueConflict(error)) {
                    throw error;
                }

                const conflictedTag = await deps.findTagByName(normalizedName);

                if (!conflictedTag) {
                    throw error;
                }

                return {
                    created: false,
                    normalizedName,
                    tag: serializeTag(conflictedTag),
                };
            }

            return {
                created: true,
                normalizedName,
                tag: serializeTag(createdTag),
            };
        },
    };
};

const defaultTagOrganizationService = createTagOrganizationService({
    createTag: async (name) => {
        return models.tag.create({ data: { name } });
    },
    findTagByName: async (name) => {
        return models.tag.findFirst({
            where: { name },
            orderBy: { createdAt: 'asc' },
        });
    },
});

export const ensureTagByName = async (name: string) => {
    return defaultTagOrganizationService.ensureTag(name);
};
