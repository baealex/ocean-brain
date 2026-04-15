import {
    EMPTY_VIEWS_WORKSPACE,
    getActiveViewTab,
    getViewTagMatchToken,
    normalizeViewTagNames,
    reorderViewSectionsInWorkspace,
    reorderViewTabsInWorkspace,
    setActiveViewTabInWorkspace,
} from './view-dashboard';

describe('view-dashboard helpers', () => {
    it('normalizes hash-prefixed or plain tags to the canonical @ form', () => {
        expect(normalizeViewTagNames([' project ', '#doing', '@todo', ''])).toEqual(['@project', '@doing', '@todo']);
    });

    it('returns the first tab when the active id is missing', () => {
        expect(
            getActiveViewTab({
                activeTabId: 'missing',
                tabs: [
                    { id: 'tab-1', title: 'Now', order: 0, sections: [] },
                    { id: 'tab-2', title: 'Agent', order: 1, sections: [] },
                ],
            }),
        ).toEqual({ id: 'tab-1', title: 'Now', order: 0, sections: [] });
    });

    it('keeps an empty workspace stable', () => {
        expect(getActiveViewTab(EMPTY_VIEWS_WORKSPACE)).toBeNull();
    });

    it('sets the active tab only when the id exists', () => {
        expect(
            setActiveViewTabInWorkspace(
                {
                    activeTabId: 'tab-1',
                    tabs: [
                        { id: 'tab-1', title: 'Now', order: 0, sections: [] },
                        { id: 'tab-2', title: 'Agent', order: 1, sections: [] },
                    ],
                },
                'tab-2',
            ),
        ).toEqual({
            activeTabId: 'tab-2',
            tabs: [
                { id: 'tab-1', title: 'Now', order: 0, sections: [] },
                { id: 'tab-2', title: 'Agent', order: 1, sections: [] },
            ],
        });
    });

    it('reorders tabs by active and over ids while preserving the active tab id', () => {
        expect(
            reorderViewTabsInWorkspace(
                {
                    activeTabId: 'tab-2',
                    tabs: [
                        { id: 'tab-1', title: 'Now', order: 0, sections: [] },
                        { id: 'tab-2', title: 'Agent', order: 1, sections: [] },
                        { id: 'tab-3', title: 'Writing', order: 2, sections: [] },
                    ],
                },
                'tab-3',
                'tab-1',
            ),
        ).toEqual({
            activeTabId: 'tab-2',
            tabs: [
                { id: 'tab-3', title: 'Writing', order: 2, sections: [] },
                { id: 'tab-1', title: 'Now', order: 0, sections: [] },
                { id: 'tab-2', title: 'Agent', order: 1, sections: [] },
            ],
        });
    });

    it('reorders sections inside the selected tab', () => {
        expect(
            reorderViewSectionsInWorkspace(
                {
                    activeTabId: 'tab-1',
                    tabs: [
                        {
                            id: 'tab-1',
                            title: 'Now',
                            order: 0,
                            sections: [
                                {
                                    id: 'section-1',
                                    tabId: 'tab-1',
                                    title: 'One',
                                    tagNames: ['@one'],
                                    mode: 'and',
                                    limit: 5,
                                    order: 0,
                                },
                                {
                                    id: 'section-2',
                                    tabId: 'tab-1',
                                    title: 'Two',
                                    tagNames: ['@two'],
                                    mode: 'and',
                                    limit: 5,
                                    order: 1,
                                },
                                {
                                    id: 'section-3',
                                    tabId: 'tab-1',
                                    title: 'Three',
                                    tagNames: ['@three'],
                                    mode: 'or',
                                    limit: 3,
                                    order: 2,
                                },
                            ],
                        },
                    ],
                },
                'tab-1',
                'section-3',
                'section-1',
            ).tabs[0]?.sections.map((section) => section.id),
        ).toEqual(['section-3', 'section-1', 'section-2']);
    });

    it('returns a short conjunction token for tag matching', () => {
        expect(getViewTagMatchToken('and')).toBe('AND');
        expect(getViewTagMatchToken('or')).toBe('OR');
    });
});
