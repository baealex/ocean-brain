import type { LocalDemoState } from '~/modules/local-demo/types';

export const createLocalDemoState = (): LocalDemoState => ({
    version: 6,
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
        activeTabId: null,
        tabs: [],
    },
});
