// @vitest-environment node
import { migrateViewWorkspace } from './view-workspace-compat';

describe('persisted demo workspace migration', () => {
    it('keeps existing group and view identities, filters and display settings', () => {
        const view = {
            id: '42',
            tabId: '7',
            title: 'Meeting notes',
            displayType: 'list' as const,
            tagNames: ['@meeting'],
            mode: 'and' as const,
            propertyFilters: [],
            sortBy: 'updatedAt' as const,
            sortOrder: 'desc' as const,
            limit: 5,
            order: 0,
            displayOptions: {
                tableColumns: ['title' as const],
                tablePropertyKeys: [],
                boardGroupByPropertyKey: null,
                calendarDateField: 'createdAt' as const,
                calendarDatePropertyKey: null,
            },
        };

        const migrated = migrateViewWorkspace({
            activeTabId: '7',
            tabs: [{ id: '7', title: 'Project A', order: 0, sections: [view] }],
        });

        const { tabId, ...fields } = view;
        expect(migrated).toEqual({
            activeGroupId: '7',
            groups: [{ id: '7', title: 'Project A', order: 0, views: [{ ...fields, groupId: tabId }] }],
        });
        expect(migrateViewWorkspace(migrated)).toEqual(migrated);
    });
});
