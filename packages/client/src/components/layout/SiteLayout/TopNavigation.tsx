import { Link, useLocation } from '@tanstack/react-router';

import * as Icon from '~/components/icon';
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
        <nav aria-label="Primary navigation" className="flex gap-1 px-4 py-2.5">
            {NAVIGATION_ITEMS.map((item) => {
                const isActive = pathname === item.path;

                return (
                    <Link key={item.path} to={item.path}>
                        <div
                            className={`flex items-center gap-2 border-b px-2 py-2 text-sm font-medium transition-colors ${
                                isActive
                                    ? 'border-fg-muted text-fg-default'
                                    : 'border-transparent text-fg-secondary hover:border-border-subtle hover:text-fg-default'
                            }`}>
                            <item.icon className="size-5" weight={isActive ? 'fill' : 'regular'} />
                            {item.name}
                        </div>
                    </Link>
                );
            })}
        </nav>
    );
};

export default TopNavigation;
