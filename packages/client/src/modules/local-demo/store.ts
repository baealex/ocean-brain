import { createLocalDemoSeed } from './seed';
import type { LocalDemoState } from './types';
import { migrateViewWorkspace, type PersistedViewsWorkspace } from './view-workspace-compat';

const STORAGE_KEY = 'ocean-brain:local-only-demo:v7';
const LEGACY_STORAGE_KEY = 'ocean-brain:local-only-demo:v6';
const CURRENT_VERSION = 7 as const;

const createSeedState = (): LocalDemoState => {
    const tags = [
        { id: 'tag-guide', name: '@guide' },
        { id: 'tag-demo', name: '@demo' },
        { id: 'tag-graph', name: '@graph' },
        { id: 'tag-project', name: '@project' },
        { id: 'tag-task', name: '@task' },
        { id: 'tag-research', name: '@research' },
        { id: 'tag-meeting', name: '@meeting' },
        { id: 'tag-editor', name: '@editor' },
        { id: 'tag-media', name: '@media' },
        { id: 'tag-archive', name: '@archive' },
    ];
    const seed = createLocalDemoSeed({ tags, nowMs: Date.now() });

    return {
        version: CURRENT_VERSION,
        workspaces: [
            {
                id: '1',
                name: 'Notes',
                archivedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ],
        viewActiveGroupIds: {},
        notes: seed.notes.map((note) => ({ ...note, workspaceId: '1' })),
        trashedNotes: [],
        tags,
        reminders: seed.reminders,
        placeholders: [],
        images: [],
        cache: {},
        propertyDefinitions: seed.propertyDefinitions.map((definition) => ({ ...definition, workspaceId: '1' })),
        mcp: {
            enabled: false,
            hasActiveToken: false,
            token: null,
        },
        viewWorkspace: {
            activeGroupId: seed.viewGroups[0]?.id ?? null,
            groups: seed.viewGroups.map((group) => ({
                ...group,
                workspaceId: '1',
                views: group.views.map((view) => ({ ...view, workspaceId: '1' })),
            })),
        },
    };
};

const getLocalStorage = () => {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

const normalizeViewWorkspace = (stored: PersistedViewsWorkspace): LocalDemoState['viewWorkspace'] => ({
    ...migrateViewWorkspace(stored),
    groups: migrateViewWorkspace(stored).groups.map((group) => ({
        ...group,
        workspaceId: group.workspaceId ?? '1',
        views: group.views.map((view) => ({
            ...view,
            workspaceId: view.workspaceId ?? group.workspaceId ?? '1',
            displayOptions: {
                ...view.displayOptions,
                calendarDateField:
                    view.displayOptions.calendarDateField === 'updatedAt' ||
                    view.displayOptions.calendarDateField === 'property'
                        ? view.displayOptions.calendarDateField
                        : 'createdAt',
                calendarDatePropertyKey:
                    view.displayOptions.calendarDateField === 'property'
                        ? view.displayOptions.calendarDatePropertyKey?.trim() || null
                        : null,
            },
        })),
    })),
});

const mergeState = (raw: unknown): LocalDemoState => {
    const seed = createSeedState();
    if (!raw || typeof raw !== 'object') return seed;

    const value = raw as Omit<Partial<LocalDemoState>, 'viewWorkspace'> & { viewWorkspace?: PersistedViewsWorkspace };

    return {
        ...seed,
        ...value,
        version: CURRENT_VERSION,
        workspaces:
            Array.isArray(value.workspaces) && value.workspaces.some((workspace) => workspace.id === '1')
                ? value.workspaces
                : seed.workspaces,
        viewActiveGroupIds: value.viewActiveGroupIds ?? {},
        notes: (Array.isArray(value.notes) ? value.notes : seed.notes).map((note) => ({
            ...note,
            workspaceId: note.workspaceId ?? '1',
        })),
        trashedNotes: (Array.isArray(value.trashedNotes) ? value.trashedNotes : seed.trashedNotes).map((note) => ({
            ...note,
            workspaceId: note.workspaceId ?? '1',
        })),
        tags: Array.isArray(value.tags) ? value.tags : seed.tags,
        reminders: Array.isArray(value.reminders) ? value.reminders : seed.reminders,
        placeholders: Array.isArray(value.placeholders) ? value.placeholders : seed.placeholders,
        images: Array.isArray(value.images) ? value.images : seed.images,
        cache: value.cache && typeof value.cache === 'object' ? value.cache : seed.cache,
        propertyDefinitions: (Array.isArray(value.propertyDefinitions)
            ? value.propertyDefinitions
            : seed.propertyDefinitions
        ).map((definition) => ({ ...definition, workspaceId: definition.workspaceId ?? '1' })),
        mcp: value.mcp && typeof value.mcp === 'object' ? { ...seed.mcp, ...value.mcp } : seed.mcp,
        viewWorkspace:
            value.viewWorkspace &&
            (('groups' in value.viewWorkspace && Array.isArray(value.viewWorkspace.groups)) ||
                ('tabs' in value.viewWorkspace && Array.isArray(value.viewWorkspace.tabs)))
                ? normalizeViewWorkspace(value.viewWorkspace)
                : seed.viewWorkspace,
    };
};

export class LocalDemoStore {
    private state: LocalDemoState | null = null;

    read() {
        if (this.state) return this.state;

        const storage = getLocalStorage();

        if (!storage) {
            this.state = createSeedState();
            return this.state;
        }

        const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) {
            this.state = createSeedState();
            this.save();
            return this.state;
        }

        try {
            this.state = mergeState(JSON.parse(raw));
            this.save();
            return this.state;
        } catch {
            this.state = createSeedState();
            this.save();
            return this.state;
        }
    }

    save() {
        const storage = getLocalStorage();
        if (!storage || !this.state) return;

        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch {
            // Keep the in-memory state usable when localStorage is blocked or full.
        }
    }

    update<T>(mutator: (state: LocalDemoState) => T) {
        const result = mutator(this.read());
        this.save();
        return result;
    }
}

export const localDemoStore = new LocalDemoStore();
