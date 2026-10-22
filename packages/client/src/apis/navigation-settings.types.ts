export interface NavigationPreferences extends Record<string, unknown> {
    schemaVersion: 1;
    order: string[];
    hiddenCoreIds: string[];
}

export interface NavigationSettings {
    preferences: NavigationPreferences | null;
    revision: string | null;
    status: 'ready' | 'invalid' | 'unsupported';
}

export interface SaveNavigationSettings {
    expectedRevision: string | null;
    preferences: NavigationPreferences | null;
    pins?: { id: string; pinned: boolean; expectedUpdatedAt: string }[];
}
