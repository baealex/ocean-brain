import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { Fragment, useEffect, useRef } from 'react';
import { fetchIntegrations } from '~/apis/integration.api';
import { fetchNavigationSettings } from '~/apis/navigation-settings.api';
import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { getSearchShortcutLabel } from '~/modules/keyboard-shortcuts';
import {
    integrationMenuId,
    isCoreMenuVisible,
    isIntegrationMenuVisible,
    orderNavigationItems,
} from '~/modules/navigation-preferences';
import { queryKeys } from '~/modules/query-key-factory';
import { HOME_ROUTE, INTEGRATION_ROUTE, SEARCH_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';
import { CORE_NAVIGATION_ITEMS } from './navigation-items';

const revealLink = (link: HTMLAnchorElement | null) => {
    if (typeof link?.scrollIntoView === 'function') {
        link.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
};

const TopNavigation = () => {
    const { workspaceId, multiple } = useWorkspace();
    const pathname = useLocation({ select: (location) => location.pathname });
    const searchShortcutLabel = getSearchShortcutLabel();
    const { data: settings } = useQuery({
        queryKey: queryKeys.navigation.settings(),
        queryFn: fetchNavigationSettings,
    });
    const { data: integrations = [] } = useQuery({
        queryKey: queryKeys.integrations.list(),
        queryFn: fetchIntegrations,
    });
    const items = orderNavigationItems(
        [
            ...CORE_NAVIGATION_ITEMS.filter((item) => isCoreMenuVisible(item.id, settings?.preferences)),
            ...integrations.filter(isIntegrationMenuVisible).map((integration) => ({
                id: integrationMenuId(integration.id),
                name: integration.manifest.name,
                path: INTEGRATION_ROUTE,
                icon: Icon.LinkIcon,
                integration,
            })),
        ],
        settings?.preferences?.order,
    );
    const getItemPath = (item: (typeof items)[number]) =>
        'integration' in item ? `/integrations/${encodeURIComponent(item.integration.id)}` : item.path;
    const isItemActive = (path: string) =>
        pathname === path || (path !== HOME_ROUTE && pathname.startsWith(`${path}/`));
    const activeItemId = items.find((item) => isItemActive(getItemPath(item)))?.id;
    // A page without its own tab, such as a note, keeps the Search tab in view on narrow screens.
    const revealedItemId = activeItemId ?? items.find((item) => item.path === SEARCH_ROUTE)?.id;
    const revealedLinkRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        if (activeItemId) {
            revealLink(revealedLinkRef.current);
        }
    }, [activeItemId, pathname]);

    // Only on entry: a new note's URL changes while the user is typing in it.
    useEffect(() => {
        if (!activeItemId) {
            revealLink(revealedLinkRef.current);
        }
    }, [activeItemId]);

    return (
        <nav aria-label="Primary navigation" className="flex items-center gap-1 px-4 py-2.5">
            {items.map((item, index) => {
                const connectionId = 'integration' in item ? item.integration.id : undefined;
                const isActive = item.id === activeItemId;
                const shortcut = item.path === SEARCH_ROUTE ? searchShortcutLabel : undefined;

                return (
                    <Fragment key={item.id}>
                        {index > 0 && <span className="h-3.5 w-px shrink-0 bg-border-subtle" />}
                        <Link
                            ref={item.id === revealedItemId ? revealedLinkRef : undefined}
                            to={item.path}
                            search={multiple ? { workspace: workspaceId } : undefined}
                            params={connectionId ? { connectionId } : undefined}
                            aria-keyshortcuts={shortcut ? 'Meta+K Control+K' : undefined}
                            title={
                                shortcut
                                    ? `${item.name} (${shortcut})`
                                    : 'integration' in item
                                      ? item.integration.manifest.description
                                      : undefined
                            }
                        >
                            <div
                                className={`flex min-w-26 items-center justify-center gap-2 border-b px-2 py-2 transition-colors ${
                                    isActive
                                        ? 'border-fg-muted text-fg-default'
                                        : 'border-transparent text-fg-secondary hover:border-border-subtle hover:text-fg-default'
                                }`}
                            >
                                <item.icon className="size-5" weight={isActive ? 'fill' : 'regular'} />
                                <Text as="span" variant="meta" weight="medium" tone="current">
                                    {item.name}
                                </Text>
                            </div>
                        </Link>
                    </Fragment>
                );
            })}
        </nav>
    );
};

export default TopNavigation;
