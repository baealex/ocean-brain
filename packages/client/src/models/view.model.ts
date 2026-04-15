export type ViewTagMatchMode = 'and' | 'or';

export interface ViewSection {
    id: string;
    tabId: string;
    title: string;
    tagNames: string[];
    mode: ViewTagMatchMode;
    limit: number;
    order: number;
}

export interface ViewTab {
    id: string;
    title: string;
    order: number;
    sections: ViewSection[];
}

export interface ViewsWorkspace {
    activeTabId: string | null;
    tabs: ViewTab[];
}
