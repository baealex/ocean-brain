export const TAG_DEFAULT_LIMIT = 100;
export const TAG_LIMIT_OPTIONS = [50, TAG_DEFAULT_LIMIT, 200] as const;

export type TagLimit = (typeof TAG_LIMIT_OPTIONS)[number];

export function isTagLimit(value: number): value is TagLimit {
    return TAG_LIMIT_OPTIONS.includes(value as TagLimit);
}
