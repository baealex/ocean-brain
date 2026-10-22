import { localDemoStore } from '~/modules/local-demo/store';
import type { NavigationPreferences, NavigationSettings, SaveNavigationSettings } from './navigation-settings.types';

const STORAGE_KEY = 'UI_NAVIGATION';
const readSettings = (): NavigationSettings => {
    const raw = localDemoStore.read().cache[STORAGE_KEY] ?? null;
    if (raw === null) return { preferences: null, revision: null, status: 'ready' };
    try {
        const value: unknown = JSON.parse(raw);
        if (typeof value !== 'object' || value === null || !('schemaVersion' in value)) throw new Error();
        if (typeof value.schemaVersion === 'number' && value.schemaVersion > 1) {
            return { preferences: null, revision: raw, status: 'unsupported' };
        }
        if (
            value.schemaVersion !== 1 ||
            !('order' in value) ||
            !Array.isArray(value.order) ||
            !value.order.every((id) => typeof id === 'string') ||
            !('hiddenCoreIds' in value) ||
            !Array.isArray(value.hiddenCoreIds) ||
            !value.hiddenCoreIds.every((id) => typeof id === 'string')
        )
            throw new Error();
        const preferences: NavigationPreferences = {
            ...value,
            schemaVersion: 1,
            order: value.order,
            hiddenCoreIds: value.hiddenCoreIds,
        };
        return { preferences, revision: raw, status: 'ready' };
    } catch {
        return { preferences: null, revision: raw, status: 'invalid' };
    }
};

export const fetchNavigationSettings = async () => readSettings();
export const saveNavigationSettings = async (input: SaveNavigationSettings) => {
    const current = readSettings();
    if (current.revision !== input.expectedRevision) throw new Error('Menu settings changed. Reload before saving.');
    if (current.status === 'unsupported') throw new Error('Update Ocean Brain to edit these menu settings.');
    localDemoStore.update((state) => {
        if (input.preferences === null) delete state.cache[STORAGE_KEY];
        else state.cache[STORAGE_KEY] = JSON.stringify({ ...current.preferences, ...input.preferences });
    });
    return readSettings();
};
