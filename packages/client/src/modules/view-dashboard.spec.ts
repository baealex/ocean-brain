// @vitest-environment node
import {
    buildViewInput,
    EMPTY_VIEWS_WORKSPACE,
    formatViewTagFilterName,
    getActiveViewGroup,
    getViewSortSummary,
    getViewTableColumnLabel,
    moveViewGroupInWorkspace,
    moveViewInWorkspace,
    normalizeViewTableColumns,
    normalizeViewTagFilterNames,
    reorderViewGroupsInWorkspace,
    reorderViewsInWorkspace,
    setActiveViewGroupInWorkspace,
} from './view-dashboard';

const createView = (view: {
    id: string;
    groupId: string;
    title: string;
    tagNames: string[];
    mode: 'and' | 'or';
    limit: number;
    order: number;
}) => ({
    displayType: 'list' as const,
    displayOptions: {
        tableColumns: ['title', 'tags', 'properties', 'createdAt', 'updatedAt'] as const,
        tablePropertyKeys: [] as const,
        boardGroupByPropertyKey: null,
        calendarDateField: 'createdAt' as const,
        calendarDatePropertyKey: null,
    },
    propertyFilters: [],
    sortBy: 'updatedAt' as const,
    sortOrder: 'desc' as const,
    ...view,
});

describe('view-dashboard helpers', () => {
    it('normalizes plain or @-prefixed tags and ignores hash-prefixed tags', () => {
        expect(normalizeViewTagFilterNames([' project ', '#doing', '@todo', ''])).toEqual(['@project', '@todo']);
    });

    it.each([
        ['project', '@project'],
        ['@project', '@project'],
        [' 제품 ', '@제품'],
    ])('shows the tag filter %j as the tag name %j used on note rows', (tagName, expected) => {
        expect(formatViewTagFilterName(tagName)).toBe(expected);
    });

    it.each([
        ['updatedAt', 'desc', 'Updated, newest first'],
        ['updatedAt', 'asc', 'Updated, oldest first'],
        ['createdAt', 'desc', 'Created, newest first'],
        ['createdAt', 'asc', 'Created, oldest first'],
        ['title', 'asc', 'Title, A to Z'],
        ['title', 'desc', 'Title, Z to A'],
    ] as const)('summarizes %s %s sorting as %j', (sortBy, sortOrder, expected) => {
        expect(getViewSortSummary(sortBy, sortOrder)).toBe(expected);
    });

    it('returns the first group when the active id is missing', () => {
        expect(
            getActiveViewGroup({
                activeGroupId: 'missing',
                groups: [
                    { id: 'group-1', title: 'Now', order: 0, views: [] },
                    { id: 'group-2', title: 'Agent', order: 1, views: [] },
                ],
            }),
        ).toEqual({ id: 'group-1', title: 'Now', order: 0, views: [] });
    });

    it('keeps an empty workspace stable', () => {
        expect(getActiveViewGroup(EMPTY_VIEWS_WORKSPACE)).toBeNull();
    });

    it('sets the active group only when the id exists', () => {
        expect(
            setActiveViewGroupInWorkspace(
                {
                    activeGroupId: 'group-1',
                    groups: [
                        { id: 'group-1', title: 'Now', order: 0, views: [] },
                        { id: 'group-2', title: 'Agent', order: 1, views: [] },
                    ],
                },
                'group-2',
            ),
        ).toEqual({
            activeGroupId: 'group-2',
            groups: [
                { id: 'group-1', title: 'Now', order: 0, views: [] },
                { id: 'group-2', title: 'Agent', order: 1, views: [] },
            ],
        });
    });

    it('reorders groups by active and over ids while preserving the active group id', () => {
        expect(
            reorderViewGroupsInWorkspace(
                {
                    activeGroupId: 'group-2',
                    groups: [
                        { id: 'group-1', title: 'Now', order: 0, views: [] },
                        { id: 'group-2', title: 'Agent', order: 1, views: [] },
                        { id: 'group-3', title: 'Writing', order: 2, views: [] },
                    ],
                },
                'group-3',
                'group-1',
            ),
        ).toEqual({
            activeGroupId: 'group-2',
            groups: [
                { id: 'group-3', title: 'Writing', order: 2, views: [] },
                { id: 'group-1', title: 'Now', order: 0, views: [] },
                { id: 'group-2', title: 'Agent', order: 1, views: [] },
            ],
        });
    });

    it('reorders views inside the selected group', () => {
        expect(
            reorderViewsInWorkspace(
                {
                    activeGroupId: 'group-1',
                    groups: [
                        {
                            id: 'group-1',
                            title: 'Now',
                            order: 0,
                            views: [
                                createView({
                                    id: 'view-1',
                                    groupId: 'group-1',
                                    title: 'One',
                                    tagNames: ['@one'],
                                    mode: 'and',
                                    limit: 5,
                                    order: 0,
                                }),
                                createView({
                                    id: 'view-2',
                                    groupId: 'group-1',
                                    title: 'Two',
                                    tagNames: ['@two'],
                                    mode: 'and',
                                    limit: 5,
                                    order: 1,
                                }),
                                createView({
                                    id: 'view-3',
                                    groupId: 'group-1',
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
                'group-1',
                'view-3',
                'view-1',
            ).groups[0]?.views.map((view) => view.id),
        ).toEqual(['view-3', 'view-1', 'view-2']);
    });

    it('moves groups and views one position for non-drag reorder controls', () => {
        const viewOne = createView({
            id: 'view-1',
            groupId: 'group-1',
            title: 'One',
            tagNames: [],
            mode: 'and',
            limit: 5,
            order: 0,
        });
        const viewTwo = createView({
            id: 'view-2',
            groupId: 'group-1',
            title: 'Two',
            tagNames: [],
            mode: 'and',
            limit: 5,
            order: 1,
        });
        const workspace = {
            activeGroupId: 'group-1',
            groups: [
                { id: 'group-1', title: 'Now', order: 0, views: [viewOne, viewTwo] },
                { id: 'group-2', title: 'Later', order: 1, views: [] },
            ],
        };

        expect(moveViewGroupInWorkspace(workspace, 'group-1', 'next').groups.map((group) => group.id)).toEqual([
            'group-2',
            'group-1',
        ]);
        expect(
            moveViewInWorkspace(workspace, 'group-1', 'view-2', 'previous').groups[0]?.views.map((view) => view.id),
        ).toEqual(['view-2', 'view-1']);
        expect(moveViewGroupInWorkspace(workspace, 'group-1', 'previous')).toBe(workspace);
    });

    it('normalizes table columns and keeps title visible', () => {
        expect(normalizeViewTableColumns(['tags', 'tags', 'updatedAt'])).toEqual(['title', 'tags', 'updatedAt']);
        expect(normalizeViewTableColumns([])).toEqual(['title', 'tags', 'properties', 'createdAt', 'updatedAt']);
        expect(getViewTableColumnLabel('createdAt')).toBe('Created');
    });

    it('builds a mutation input from a saved view while preserving filters', () => {
        expect(
            buildViewInput(
                createView({
                    id: 'view-1',
                    groupId: 'group-1',
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
                tablePropertyKeys: [],
                boardGroupByPropertyKey: null,
                calendarDateField: 'createdAt',
                calendarDatePropertyKey: null,
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
