import {
    buildViewSectionInput,
    EMPTY_VIEWS_WORKSPACE,
    formatViewPropertyFilter,
    getActiveViewTab,
    getViewDisplayTypeLabel,
    getViewPropertyOperatorLabel,
    getViewTableColumnLabel,
    getViewTagMatchLabel,
    getViewTagMatchToken,
    normalizeViewTableColumns,
    normalizeViewTagNames,
    reorderViewSectionsInWorkspace,
    reorderViewTabsInWorkspace,
    setActiveViewTabInWorkspace,
} from './view-dashboard';

const createSection = (section: {
    id: string;
    tabId: string;
    title: string;
    tagNames: string[];
    mode: 'and' | 'or';
    limit: number;
    order: number;
}) => ({
    displayType: 'list' as const,
    displayOptions: {
        tableColumns: ['title', 'tags', 'properties', 'createdAt', 'updatedAt'] as const,
    },
    propertyFilters: [],
    sortBy: 'updatedAt' as const,
    sortOrder: 'desc' as const,
    ...section,
});

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
                                createSection({
                                    id: 'section-1',
                                    tabId: 'tab-1',
                                    title: 'One',
                                    tagNames: ['@one'],
                                    mode: 'and',
                                    limit: 5,
                                    order: 0,
                                }),
                                createSection({
                                    id: 'section-2',
                                    tabId: 'tab-1',
                                    title: 'Two',
                                    tagNames: ['@two'],
                                    mode: 'and',
                                    limit: 5,
                                    order: 1,
                                }),
                                createSection({
                                    id: 'section-3',
                                    tabId: 'tab-1',
                                    title: 'Three',
                                    tagNames: ['@three'],
                                    mode: 'or',
                                    limit: 3,
                                    order: 2,
                                }),
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

    it('returns clear labels and short conjunction tokens for tag matching', () => {
        expect(getViewTagMatchLabel('and')).toBe('AND — all selected tags');
        expect(getViewTagMatchLabel('or')).toBe('OR — any selected tag');
        expect(getViewTagMatchToken('and')).toBe('AND');
        expect(getViewTagMatchToken('or')).toBe('OR');
    });

    it('formats property filter labels for display', () => {
        expect(getViewPropertyOperatorLabel('notEquals')).toBe('is not');
        expect(getViewPropertyOperatorLabel('contains')).toBe('contains');
        expect(getViewPropertyOperatorLabel('notContains')).toBe('does not contain');
        expect(getViewPropertyOperatorLabel('exists')).toBe('is set');
        expect(getViewPropertyOperatorLabel('notExists')).toBe('is empty');
        expect(
            formatViewPropertyFilter({
                key: 'state',
                name: 'State',
                valueType: 'select',
                operator: 'equals',
                value: 'doing',
            }),
        ).toBe('State is doing');
        expect(
            formatViewPropertyFilter({
                key: 'state',
                name: 'State',
                valueType: 'select',
                operator: 'exists',
                value: null,
            }),
        ).toBe('State is set');
        expect(
            formatViewPropertyFilter({
                key: 'source',
                name: 'Source',
                valueType: 'url',
                operator: 'contains',
                value: 'github.com',
            }),
        ).toBe('Source contains github.com');
    });

    it('labels supported view display types', () => {
        expect(getViewDisplayTypeLabel('list')).toBe('List');
        expect(getViewDisplayTypeLabel('table')).toBe('Table');
        expect(getViewDisplayTypeLabel('calendar')).toBe('Unavailable');
    });

    it('normalizes table columns and keeps title visible', () => {
        expect(normalizeViewTableColumns(['tags', 'tags', 'updatedAt'])).toEqual(['title', 'tags', 'updatedAt']);
        expect(normalizeViewTableColumns([])).toEqual(['title', 'tags', 'properties', 'createdAt', 'updatedAt']);
        expect(getViewTableColumnLabel('createdAt')).toBe('Created');
    });

    it('builds a mutation input from a saved section while preserving filters', () => {
        expect(
            buildViewSectionInput(
                createSection({
                    id: 'section-1',
                    tabId: 'tab-1',
                    title: 'Tasks',
                    tagNames: ['@제품'],
                    mode: 'and',
                    limit: 5,
                    order: 0,
                }),
                {
                    sortBy: 'title',
                    sortOrder: 'asc',
                },
            ),
        ).toEqual({
            title: 'Tasks',
            displayType: 'list',
            displayOptions: {
                tableColumns: ['title', 'tags', 'properties', 'createdAt', 'updatedAt'],
            },
            tagNames: ['@제품'],
            mode: 'and',
            propertyFilters: [],
            sortBy: 'title',
            sortOrder: 'asc',
            limit: 5,
        });
    });
});
