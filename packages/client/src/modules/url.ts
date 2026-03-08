export const HOME_ROUTE = '/' as const;
export const CALENDAR_ROUTE = '/calendar' as const;
export const REMINDERS_ROUTE = '/reminders' as const;
export const GRAPH_ROUTE = '/graph' as const;
export const SEARCH_ROUTE = '/search' as const;
export const TAG_ROUTE = '/tag' as const;
export const NOTE_ROUTE = '/$id' as const;
export const TAG_NOTES_ROUTE = '/tag/$id' as const;
export const SETTINGS_ROUTE = '/setting' as const;
export const SETTINGS_MANAGE_IMAGE_ROUTE = '/setting/manage-image' as const;
export const SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE = '/setting/manage-image/$id' as const;
export const SETTINGS_PLACEHOLDER_ROUTE = '/setting/placeholder' as const;

export const getTagURL = (id: string) => `/tag/${id}`;
export const getNoteURL = (id: string) => `/${id}`;
export const getImageNotesURL = (id: string) => `/setting/manage-image/${id}`;
