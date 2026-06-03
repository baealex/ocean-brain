export const HOME_DEFAULT_LIMIT = 28;
export const HOME_LIMIT_OPTIONS = [HOME_DEFAULT_LIMIT, 50, 100] as const;

export type HomeLimit = (typeof HOME_LIMIT_OPTIONS)[number];

export function isHomeLimit(value: number): value is HomeLimit {
    return HOME_LIMIT_OPTIONS.includes(value as HomeLimit);
}
