import type { ViewSection } from '~/models/view.model';
import { localError, success } from '../response';
import type { LocalDemoPlugin } from '../types';
import { applyPropertyFilters, createLocalId, listNotesByTags, paginate } from '../utils';

export const viewsLocalPlugin: LocalDemoPlugin = {
    name: 'views',
    graphHandlers: {
        FetchViewWorkspace: ({ state }) => success({ viewWorkspace: state.viewWorkspace }),
        FetchViewSection: ({ state, variables }) => {
            const section = state.viewWorkspace.tabs
                .flatMap((tab) => tab.sections)
                .find((item) => item.id === String(variables.id));
            return success({ viewSection: section ?? null });
        },
        FetchViewSectionNotes: ({ state, variables }) => {
            const section = state.viewWorkspace.tabs
                .flatMap((tab) => tab.sections)
                .find((item) => item.id === String(variables.id));
            const notes = section
                ? applyPropertyFilters(listNotesByTags(state, section.tagNames, section.mode), section.propertyFilters)
                : [];
            return success({ viewSectionNotes: { totalCount: notes.length, notes: paginate(notes, variables) } });
        },
        CreateViewTab: ({ state, variables, save }) => {
            const tab = {
                id: createLocalId('view-tab'),
                title: String(variables.title),
                order: state.viewWorkspace.tabs.length,
                sections: [],
            };
            state.viewWorkspace.tabs.push(tab);
            state.viewWorkspace.activeTabId = tab.id;
            save();
            return success({ createViewTab: { id: tab.id } });
        },
        UpdateViewTab: ({ state, variables, save }) => {
            const tab = state.viewWorkspace.tabs.find((item) => item.id === String(variables.id));
            if (tab) tab.title = String(variables.title);
            save();
            return success({ updateViewTab: { id: String(variables.id) } });
        },
        DeleteViewTab: ({ state, variables, save }) => {
            state.viewWorkspace.tabs = state.viewWorkspace.tabs.filter((tab) => tab.id !== String(variables.id));
            state.viewWorkspace.activeTabId = state.viewWorkspace.tabs[0]?.id ?? null;
            save();
            return success({ deleteViewTab: true });
        },
        SetActiveViewTab: ({ state, variables, save }) => {
            state.viewWorkspace.activeTabId = String(variables.id);
            save();
            return success({ setActiveViewTab: state.viewWorkspace });
        },
        ReorderViewTabs: ({ state, variables, save }) => {
            const tabIds = variables.tabIds as string[];
            state.viewWorkspace.tabs.sort((a, b) => tabIds.indexOf(a.id) - tabIds.indexOf(b.id));
            state.viewWorkspace.tabs.forEach((tab, index) => (tab.order = index));
            save();
            return success({ reorderViewTabs: state.viewWorkspace.tabs.map((tab) => ({ id: tab.id })) });
        },
        CreateViewSection: ({ state, variables, save }) => {
            const tab = state.viewWorkspace.tabs.find((item) => item.id === String(variables.tabId));
            if (!tab) return localError('View tab not found');

            const input = variables.input as Partial<ViewSection>;
            const section: ViewSection = {
                id: createLocalId('view-section'),
                tabId: tab.id,
                title: input.title ?? 'Untitled section',
                displayType: input.displayType ?? 'list',
                displayOptions: input.displayOptions ?? { tableColumns: [] },
                tagNames: input.tagNames ?? [],
                mode: input.mode ?? 'and',
                propertyFilters: input.propertyFilters ?? [],
                sortBy: input.sortBy ?? 'updatedAt',
                sortOrder: input.sortOrder ?? 'desc',
                limit: input.limit ?? 25,
                order: tab.sections.length,
            };
            tab.sections.push(section);
            save();
            return success({ createViewSection: { id: section.id } });
        },
        UpdateViewSection: ({ state, variables, save }) => {
            const section = state.viewWorkspace.tabs
                .flatMap((tab) => tab.sections)
                .find((item) => item.id === String(variables.id));
            if (section) Object.assign(section, variables.input);
            save();
            return success({ updateViewSection: { id: String(variables.id) } });
        },
        DeleteViewSection: ({ state, variables, save }) => {
            for (const tab of state.viewWorkspace.tabs) {
                tab.sections = tab.sections.filter((section) => section.id !== String(variables.id));
            }
            save();
            return success({ deleteViewSection: true });
        },
        ReorderViewSections: ({ state, variables, save }) => {
            const tab = state.viewWorkspace.tabs.find((item) => item.id === String(variables.tabId));
            const sectionIds = variables.sectionIds as string[];
            if (tab) {
                tab.sections.sort((a, b) => sectionIds.indexOf(a.id) - sectionIds.indexOf(b.id));
                tab.sections.forEach((section, index) => (section.order = index));
            }
            save();
            return success({ reorderViewSections: tab?.sections.map((section) => ({ id: section.id })) ?? [] });
        },
    },
};
