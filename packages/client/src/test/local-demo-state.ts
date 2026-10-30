import type { LocalDemoState } from '~/modules/local-demo/types';

export const createLocalDemoState = (): LocalDemoState => ({
    version: 7,
    workspaces: [
        {
            id: '1',
            name: 'Notes',
            archivedAt: null,
            createdAt: '2026-10-29T00:00:00Z',
            updatedAt: '2026-10-29T00:00:00Z',
        },
    ],
    viewActiveGroupIds: {},
    notes: [],
    trashedNotes: [],
    tags: [],
    reminders: [],
    placeholders: [],
    images: [],
    cache: {},
    propertyDefinitions: [],
    mcp: {
        enabled: false,
        hasActiveToken: false,
        token: null,
    },
    viewWorkspace: {
        activeGroupId: null,
        groups: [],
    },
});
