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
        <nav aria-label="Primary navigation" className="flex gap-2 p-3">
            {NAVIGATION_ITEMS.map((item) => {
                const isActive = pathname === item.path;

                return (
                    <Link key={item.path} to={item.path}>
                        <div
                            className={`flex items-center gap-2 text-sm font-bold px-3 py-2 border-2 transition-all rounded-[10px_3px_11px_3px/3px_8px_3px_10px] ${
                                isActive
                                    ? 'bg-accent-primary text-fg-on-accent border-border-secondary shadow-sketchy'
                                    : 'border-transparent hover:border-border-secondary hover:bg-hover'
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
