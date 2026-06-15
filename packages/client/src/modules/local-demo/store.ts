import { createLocalDemoSeed } from './seed';
import type { LocalDemoState } from './types';

const STORAGE_KEY = 'ocean-brain:local-only-demo:v4';
const CURRENT_VERSION = 4 as const;

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
        notes: seed.notes,
        trashedNotes: [],
        tags,
        reminders: seed.reminders,
        placeholders: [],
        images: [],
        cache: {},
        propertyDefinitions: seed.propertyDefinitions,
        mcp: {
            enabled: false,
            hasActiveToken: false,
            token: null,
        },
        viewWorkspace: {
            activeTabId: seed.viewTabs[0]?.id ?? null,
            tabs: seed.viewTabs,
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

const mergeState = (raw: unknown): LocalDemoState => {
    const seed = createSeedState();
    if (!raw || typeof raw !== 'object') return seed;

    const value = raw as Partial<LocalDemoState>;

    return {
        ...seed,
        ...value,
        version: CURRENT_VERSION,
        notes: Array.isArray(value.notes) ? value.notes : seed.notes,
        trashedNotes: Array.isArray(value.trashedNotes) ? value.trashedNotes : seed.trashedNotes,
        tags: Array.isArray(value.tags) ? value.tags : seed.tags,
        reminders: Array.isArray(value.reminders) ? value.reminders : seed.reminders,
        placeholders: Array.isArray(value.placeholders) ? value.placeholders : seed.placeholders,
        images: Array.isArray(value.images) ? value.images : seed.images,
        cache: value.cache && typeof value.cache === 'object' ? value.cache : seed.cache,
        propertyDefinitions: Array.isArray(value.propertyDefinitions)
            ? value.propertyDefinitions
            : seed.propertyDefinitions,
        mcp: value.mcp && typeof value.mcp === 'object' ? { ...seed.mcp, ...value.mcp } : seed.mcp,
        viewWorkspace:
            value.viewWorkspace && Array.isArray(value.viewWorkspace.tabs) ? value.viewWorkspace : seed.viewWorkspace,
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

        const raw = storage.getItem(STORAGE_KEY);
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
