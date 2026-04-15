import type { IResolvers } from '@graphql-tools/utils';
import { getViewSectionById, getViewSectionNotes, getViewWorkspace } from '~/features/view/services/workspace.js';
import type { Pagination } from '~/types/index.js';

type ViewQueryResolvers = NonNullable<IResolvers['Query']>;

export const viewQueryResolvers: ViewQueryResolvers = {
    viewWorkspace: async () => {
        return getViewWorkspace();
    },
    viewSection: async (_, { id }: { id: string }) => {
        return getViewSectionById(id);
    },
    viewSectionNotes: async (
        _,
        {
            id,
            pagination = {
                limit: 25,
                offset: 0,
            },
        }: {
            id: string;
            pagination: Pagination;
        },
    ) => {
        const sectionNotes = await getViewSectionNotes(id, {
            limit: Number(pagination.limit),
            offset: Number(pagination.offset),
        });

        if (!sectionNotes) {
            throw 'NOT FOUND';
        }

        return sectionNotes;
    },
};
