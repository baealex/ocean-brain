import type { IResolvers } from '@graphql-tools/utils';
import {
    createViewSection,
    createViewTab,
    deleteViewSection,
    deleteViewTab,
    reorderViewSections,
    reorderViewTabs,
    setActiveViewTab,
    updateViewSection,
    updateViewTab,
    type ViewSectionInput,
} from '~/features/view/services/workspace.js';

type ViewMutationResolvers = NonNullable<IResolvers['Mutation']>;

export const viewMutationResolvers: ViewMutationResolvers = {
    createViewTab: async (_, { title }: { title: string }) => {
        return createViewTab(title);
    },
    updateViewTab: async (_, { id, title }: { id: string; title: string }) => {
        return updateViewTab(id, title);
    },
    deleteViewTab: async (_, { id }: { id: string }) => {
        return deleteViewTab(id);
    },
    setActiveViewTab: async (_, { id }: { id: string }) => {
        return setActiveViewTab(id);
    },
    reorderViewTabs: async (_, { tabIds }: { tabIds: string[] }) => {
        return reorderViewTabs(tabIds);
    },
    createViewSection: async (
        _,
        {
            tabId,
            input,
        }: {
            tabId: string;
            input: ViewSectionInput;
        },
    ) => {
        return createViewSection(tabId, input);
    },
    updateViewSection: async (
        _,
        {
            id,
            input,
        }: {
            id: string;
            input: ViewSectionInput;
        },
    ) => {
        return updateViewSection(id, input);
    },
    deleteViewSection: async (_, { id }: { id: string }) => {
        return deleteViewSection(id);
    },
    reorderViewSections: async (
        _,
        {
            tabId,
            sectionIds,
        }: {
            tabId: string;
            sectionIds: string[];
        },
    ) => {
        return reorderViewSections(tabId, sectionIds);
    },
};
