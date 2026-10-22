import * as Icon from '~/components/icon';
import {
    CALENDAR_ROUTE,
    GRAPH_ROUTE,
    HOME_ROUTE,
    REMINDERS_ROUTE,
    SEARCH_ROUTE,
    SETTINGS_ROUTE,
    TAG_ROUTE,
    VIEWS_ROUTE,
} from '~/modules/url';

export const CORE_NAVIGATION_ITEMS = [
    { id: 'core:search', name: 'Search', path: SEARCH_ROUTE, icon: Icon.Search },
    { id: 'core:notes', name: 'Notes', path: HOME_ROUTE, icon: Icon.Grid },
    { id: 'core:views', name: 'Views', path: VIEWS_ROUTE, icon: Icon.Eye },
    { id: 'core:graph', name: 'Graph', path: GRAPH_ROUTE, icon: Icon.Graph },
    { id: 'core:calendar', name: 'Calendar', path: CALENDAR_ROUTE, icon: Icon.Calendar },
    { id: 'core:reminders', name: 'Reminders', path: REMINDERS_ROUTE, icon: Icon.Bell },
    { id: 'core:tags', name: 'Tags', path: TAG_ROUTE, icon: Icon.Tag },
    { id: 'core:settings', name: 'Setting', path: SETTINGS_ROUTE, icon: Icon.Gear },
] as const;
