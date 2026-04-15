import type { ViewSection, ViewsWorkspace, ViewTab, ViewTagMatchMode } from '~/models/view.model';

export const DEFAULT_VIEW_SECTION_LIMIT = 5;
export const MIN_VIEW_SECTION_LIMIT = 1;
export const MAX_VIEW_SECTION_LIMIT = 20;

export const EMPTY_VIEWS_WORKSPACE: ViewsWorkspace = {
    activeTabId: null,
    tabs: [],
};

const normalizeTagName = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return '';
    }

    if (trimmedValue.startsWith('@')) {
        return trimmedValue;
    }

    if (trimmedValue.startsWith('#')) {
        return `@${trimmedValue.slice(1)}`;
    }

    return `@${trimmedValue}`;
};

const reorderArrayItems = <TValue extends { id: string }>(items: TValue[], activeId: string, overId: string) => {
    if (activeId === overId) {
        return items;
    }

    const oldIndex = items.findIndex((item) => item.id === activeId);
    const newIndex = items.findIndex((item) => item.id === overId);

    if (oldIndex < 0 || newIndex < 0) {
        return items;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(oldIndex, 1);
    nextItems.splice(newIndex, 0, movedItem);
    return nextItems;
};

export const normalizeViewTagNames = (values: unknown[]) => {
    const normalizedTagNames = values.flatMap((value) => {
        if (typeof value === 'string') {
            return value.split(',');
        }

        return [];
    });

    return Array.from(new Set(normalizedTagNames.map(normalizeTagName).filter(Boolean)));
};

export const getActiveViewTab = (workspace: ViewsWorkspace): ViewTab | null => {
    if (workspace.tabs.length === 0) {
        return null;
    }

    if (!workspace.activeTabId) {
        return workspace.tabs[0] ?? null;
    }

    return workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ?? workspace.tabs[0] ?? null;
};

export const setActiveViewTabInWorkspace = (workspace: ViewsWorkspace, tabId: string): ViewsWorkspace => {
    if (!workspace.tabs.some((tab) => tab.id === tabId)) {
        return workspace;
    }

    return {
        ...workspace,
        activeTabId: tabId,
    };
};

export const reorderViewTabsInWorkspace = (
    workspace: ViewsWorkspace,
    activeTabId: string,
    overTabId: string,
): ViewsWorkspace => ({
    ...workspace,
    tabs: reorderArrayItems(workspace.tabs, activeTabId, overTabId),
});

export const reorderViewSectionsInWorkspace = (
    workspace: ViewsWorkspace,
    tabId: string,
    activeSectionId: string,
    overSectionId: string,
): ViewsWorkspace => ({
    ...workspace,
    tabs: workspace.tabs.map((tab) =>
        tab.id === tabId
            ? {
                  ...tab,
                  sections: reorderArrayItems(tab.sections, activeSectionId, overSectionId),
              }
            : tab,
    ),
});

export const getViewTagMatchLabel = (mode: ViewTagMatchMode) => {
    return mode === 'or' ? 'Matches any selected tag' : 'Matches all selected tags';
};

export const getViewTagMatchToken = (mode: ViewTagMatchMode) => {
    return mode === 'or' ? 'OR' : 'AND';
};

export const buildViewNotesSearch = (section: Pick<ViewSection, 'id'>) => ({
    page: 1,
    sectionId: section.id,
});
