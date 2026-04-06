import { Fragment } from 'react';
import { Link, useLocation } from '@tanstack/react-router';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import {
    CALENDAR_ROUTE,
    GRAPH_ROUTE,
    HOME_ROUTE,
    REMINDERS_ROUTE,
    SETTINGS_ROUTE,
    TAG_ROUTE
} from '~/modules/url';

const NAVIGATION_ITEMS = [
    {
        name: 'Notes',
        path: HOME_ROUTE,
        icon: Icon.Grid
    },
    {
        name: 'Graph',
        path: GRAPH_ROUTE,
        icon: Icon.Graph
    },
    {
        name: 'Calendar',
        path: CALENDAR_ROUTE,
        icon: Icon.Calendar
    },
    {
        name: 'Reminders',
        path: REMINDERS_ROUTE,
        icon: Icon.Bell
    },
    {
        name: 'Tags',
        path: TAG_ROUTE,
        icon: Icon.Tag
    },
    {
        name: 'Setting',
        path: SETTINGS_ROUTE,
        icon: Icon.Gear
    }
] as const;

const TopNavigation = () => {
    const pathname = useLocation({ select: (location) => location.pathname });

    return (
        <nav aria-label="Primary navigation" className="flex items-center gap-1 px-4 py-2.5">
            {NAVIGATION_ITEMS.map((item, index) => (
                <Fragment key={item.path}>
                    {index > 0 && (
                        <span className="h-3.5 w-px shrink-0 bg-border-subtle" />
                    )}
                    <Link to={item.path}>
                        <div
                            className={`flex min-w-26 items-center justify-center gap-2 border-b px-2 py-2 transition-colors ${
                                pathname === item.path
                                    ? 'border-fg-muted text-fg-default'
                                    : 'border-transparent text-fg-secondary hover:border-border-subtle hover:text-fg-default'
                            }`}>
                            <item.icon className="size-5" weight={pathname === item.path ? 'fill' : 'regular'} />
                            <Text as="span" variant="meta" weight="medium" className="text-current">
                                {item.name}
                            </Text>
                        </div>
                    </Link>
                </Fragment>
            ))}
        </nav>
    );
};

export default TopNavigation;
