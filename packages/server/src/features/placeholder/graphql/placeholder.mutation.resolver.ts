import type { IResolvers } from '@graphql-tools/utils';
import models from '~/models.js';

type PlaceholderMutationResolvers = NonNullable<IResolvers['Mutation']>;
type PlaceholderRecord = Awaited<ReturnType<typeof models.placeholder.findFirst>>;

interface CreatePlaceholderArgs {
    name: string;
    template: string;
    replacement?: string;
}

interface UpdatePlaceholderArgs {
    id: string | number;
    name?: string;
    template?: string;
    replacement?: string;
}

interface PlaceholderMutationDeps {
    createPlaceholder: (input: CreatePlaceholderArgs) => Promise<unknown>;
    deletePlaceholder: (id: number) => Promise<void>;
    findPlaceholderById: (id: number) => Promise<PlaceholderRecord>;
    updatePlaceholder: (input: { id: number; name?: string; template?: string; replacement?: string }) => Promise<void>;
}

export const createCreatePlaceholderMutationResolver = (
    deps: Pick<PlaceholderMutationDeps, 'createPlaceholder'> = {
        createPlaceholder: async (input) =>
            models.placeholder.create({
                data: {
                    name: input.name,
                    template: input.template,
                    replacement: input.replacement as string,
                },
            }),
    },
) => {
    return async (_: unknown, { name, template, replacement }: CreatePlaceholderArgs) => {
        return deps.createPlaceholder({
            name,
            template,
            replacement,
        });
    };
};

export const createUpdatePlaceholderMutationResolver = (
    deps: Pick<PlaceholderMutationDeps, 'findPlaceholderById' | 'updatePlaceholder'> = {
        findPlaceholderById: async (id) => models.placeholder.findFirst({ where: { id } }),
        updatePlaceholder: async (input) => {
            await models.placeholder.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    template: input.template,
                    replacement: input.replacement,
                },
            });
        },
    },
) => {
    return async (_: unknown, { id, name, template, replacement }: UpdatePlaceholderArgs) => {
        const placeholder = await deps.findPlaceholderById(Number(id));

        if (!placeholder) {
            throw new Error('Placeholder not found');
        }

        await deps.updatePlaceholder({
            id: Number(id),
            name,
            template,
            replacement,
        });

        return placeholder;
    };
};

export const createDeletePlaceholderMutationResolver = (
    deps: Pick<PlaceholderMutationDeps, 'findPlaceholderById' | 'deletePlaceholder'> = {
        findPlaceholderById: async (id) => models.placeholder.findFirst({ where: { id } }),
        deletePlaceholder: async (id) => {
            await models.placeholder.delete({ where: { id } });
        },
    },
) => {
    return async (_: unknown, { id }: { id: string | number }) => {
        const placeholder = await deps.findPlaceholderById(Number(id));

        if (!placeholder) {
            return false;
        }

        await deps.deletePlaceholder(Number(id));
        return true;
    };
};

export const placeholderMutationResolvers: PlaceholderMutationResolvers = {
    createPlaceholder: createCreatePlaceholderMutationResolver(),
    updatePlaceholder: createUpdatePlaceholderMutationResolver(),
    deletePlaceholder: createDeletePlaceholderMutationResolver(),
};
