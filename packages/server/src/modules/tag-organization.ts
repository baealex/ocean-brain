import models from '~/models.js';

interface TagRecord {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

interface TagOrganizationDeps {
    createTag: (name: string) => Promise<TagRecord>;
    findTagsByName: (name: string) => Promise<TagRecord[]>;
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

    const normalizedName = trimmedName.startsWith('@')
        ? trimmedName
        : `@${trimmedName}`;

    if (normalizedName === '@' || /\s/.test(normalizedName.slice(1))) {
        throw new InvalidTagNameError('Tag names must be a single token like @project.');
    }

    return normalizedName;
};

const serializeTag = (tag: TagRecord) => ({
    id: String(tag.id),
    name: tag.name,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString()
});

export const createTagOrganizationService = (deps: TagOrganizationDeps) => {
    return {
        ensureTag: async (name: string): Promise<TagOrganizationResult> => {
            const normalizedName = normalizeTagName(name);
            const existingTags = await deps.findTagsByName(normalizedName);

            if (existingTags.length > 0) {
                return {
                    created: false,
                    normalizedName,
                    tag: serializeTag(existingTags[0])
                };
            }

            const createdTag = await deps.createTag(normalizedName);
            return {
                created: true,
                normalizedName,
                tag: serializeTag(createdTag)
            };
        }
    };
};

const defaultTagOrganizationService = createTagOrganizationService({
    createTag: async (name) => {
        return models.tag.create({ data: { name } });
    },
    findTagsByName: async (name) => {
        return models.tag.findMany({
            where: { name },
            orderBy: { createdAt: 'asc' }
        });
    }
});

export const ensureTagByName = async (name: string) => {
    return defaultTagOrganizationService.ensureTag(name);
};
