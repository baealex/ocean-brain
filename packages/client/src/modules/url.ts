// Keep every client route in this object. The production route preloader derives
// reserved root segments from it so a new static route is never mistaken for /$id.
export const APP_ROUTE_PATHS = {
    HOME_ROUTE: '/',
    VIEWS_ROUTE: '/views',
    VIEW_NOTES_ROUTE: '/views/notes',
    CALENDAR_ROUTE: '/calendar',
    REMINDERS_ROUTE: '/reminders',
    GRAPH_ROUTE: '/graph',
    SEARCH_ROUTE: '/search',
    TAG_ROUTE: '/tag',
    NOTE_ROUTE: '/$id',
    TAG_NOTES_ROUTE: '/tag/$id',
    SETTINGS_ROUTE: '/setting',
    SETTINGS_APPEARANCE_ROUTE: '/setting/appearance',
    SETTINGS_MCP_ROUTE: '/setting/mcp',
    SETTINGS_TRASH_ROUTE: '/setting/trash',
    SETTINGS_MANAGE_IMAGE_ROUTE: '/setting/manage-image',
    SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE: '/setting/manage-image/$id',
    SETTINGS_PLACEHOLDER_ROUTE: '/setting/placeholder',
    SETTINGS_PROPERTIES_ROUTE: '/setting/properties',
} as const;

export const {
    HOME_ROUTE,
    VIEWS_ROUTE,
    VIEW_NOTES_ROUTE,
    CALENDAR_ROUTE,
    REMINDERS_ROUTE,
    GRAPH_ROUTE,
    SEARCH_ROUTE,
    TAG_ROUTE,
    NOTE_ROUTE,
    TAG_NOTES_ROUTE,
    SETTINGS_ROUTE,
    SETTINGS_APPEARANCE_ROUTE,
    SETTINGS_MCP_ROUTE,
    SETTINGS_TRASH_ROUTE,
    SETTINGS_MANAGE_IMAGE_ROUTE,
    SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE,
    SETTINGS_PLACEHOLDER_ROUTE,
    SETTINGS_PROPERTIES_ROUTE,
} = APP_ROUTE_PATHS;

export const getTagURL = (id: string) => `/tag/${id}`;
export const getNoteURL = (id: string) => `/${id}`;
export const getImageNotesURL = (id: string) => `/setting/manage-image/${id}`;
