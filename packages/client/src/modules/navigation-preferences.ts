import type { IntegrationConnection } from '~/apis/integration.types';
import type { NavigationPreferences } from '~/apis/navigation-settings.types';

export const integrationMenuId = (id: string) => `integration:${id}`;

export const orderNavigationItems = <T extends { id: string }>(
    items: readonly T[],
    order: readonly string[] = [],
): T[] => {
    const remaining = new Map(items.map((item) => [item.id, item]));
    const sorted: T[] = [];
    for (const id of order) {
        const item = remaining.get(id);
        if (item) {
            sorted.push(item);
            remaining.delete(id);
        }
    }
    return [...sorted, ...remaining.values()];
};

export const isCoreMenuVisible = (id: string, preferences?: NavigationPreferences | null) =>
    id === 'core:settings' || !preferences?.hiddenCoreIds.includes(id);

export const isIntegrationMenuVisible = (integration: IntegrationConnection) =>
    Boolean(integration.enabled && integration.pinned && integration.manifest.launch);

// Keep IDs unknown to this client, including menus introduced by a newer version.
export const replaceKnownMenuOrder = (savedOrder: string[], orderedIds: string[]) => {
    const knownIds = new Set(orderedIds);
    const remaining = [...orderedIds];
    const next = savedOrder.map((id) => (knownIds.has(id) ? (remaining.shift() ?? id) : id));
    return [...next, ...remaining];
};
