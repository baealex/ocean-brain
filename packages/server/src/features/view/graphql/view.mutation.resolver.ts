import type { IResolvers } from '@graphql-tools/utils';
import {
    createView,
    createViewGroup,
    deleteView,
    deleteViewGroup,
    reorderViewGroups,
    reorderViews,
    setActiveViewGroup,
    updateView,
    updateViewGroup,
    type ViewInput,
} from '~/features/view/services/workspace.js';

type ViewMutationResolvers = NonNullable<IResolvers['Mutation']>;

export const viewMutationResolvers = {
    createViewGroup: async (_, { title }: { title: string }) => {
        return createViewGroup(title);
    },
    updateViewGroup: async (_, { id, title }: { id: string; title: string }) => {
        return updateViewGroup(id, title);
    },
    deleteViewGroup: async (_, { id }: { id: string }) => {
        return deleteViewGroup(id);
    },
    setActiveViewGroup: async (_, { id }: { id: string }) => {
        return setActiveViewGroup(id);
    },
    reorderViewGroups: async (_, { groupIds }: { groupIds: string[] }) => {
        return reorderViewGroups(groupIds);
    },
    createView: async (
        _,
        {
            groupId,
            input,
        }: {
            groupId: string;
            input: ViewInput;
        },
    ) => {
        return createView(groupId, input);
    },
    updateView: async (
        _,
        {
            id,
            input,
        }: {
            id: string;
            input: ViewInput;
        },
    ) => {
        return updateView(id, input);
    },
    deleteView: async (_, { id }: { id: string }) => {
        return deleteView(id);
    },
    reorderViews: async (
        _,
        {
            groupId,
            viewIds,
        }: {
            groupId: string;
            viewIds: string[];
        },
    ) => {
        return reorderViews(groupId, viewIds);
    },
} satisfies ViewMutationResolvers;
