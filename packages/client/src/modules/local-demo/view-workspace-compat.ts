import type { View, ViewGroup, ViewsWorkspace } from '~/models/view.model';

type LegacyView = Omit<View, 'groupId'> & { tabId: string };
type LegacyViewGroup = Omit<ViewGroup, 'views'> & { sections: LegacyView[] };
export type PersistedViewsWorkspace = ViewsWorkspace | { activeTabId: string | null; tabs: LegacyViewGroup[] };

export const migrateViewWorkspace = (workspace: PersistedViewsWorkspace): ViewsWorkspace => {
    if ('groups' in workspace) return workspace;
    return {
        activeGroupId: workspace.activeTabId,
        groups: workspace.tabs.map(({ sections, ...group }) => ({
            ...group,
            views: sections.map(({ tabId, ...view }) => ({ ...view, groupId: tabId })),
        })),
    };
};
