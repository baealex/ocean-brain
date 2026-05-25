const RECENT_TIME_JUST_NOW_DURATION_MS = 60_000;
const RECENT_TIME_REFRESH_INTERVAL_MS = 60_000;

const formatElapsed = (interval: number, unit: string) => {
    return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
};

export function timeSince(timestamp: number, now = Date.now()) {
    const past = new Date(timestamp);
    const seconds = Math.max(0, Math.floor((now - past.getTime()) / 1000));
    let interval = Math.floor(seconds / 31536000);

    if (interval >= 1) {
        return formatElapsed(interval, 'year');
    }
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
        return formatElapsed(interval, 'month');
    }
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
        return formatElapsed(interval, 'day');
    }
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
        return formatElapsed(interval, 'hour');
    }
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
        return formatElapsed(interval, 'minute');
    }
    return formatElapsed(Math.floor(seconds), 'second');
}

export function recentTimeSince(timestamp: number | null, now = Date.now()) {
    if (timestamp === null) {
        return 'just now';
    }

    if (now - timestamp < RECENT_TIME_JUST_NOW_DURATION_MS) {
        return 'just now';
    }

    return timeSince(timestamp, now);
}

export function getRecentTimeSinceRefreshDelay(timestamp: number | null, now = Date.now()) {
    if (timestamp === null) {
        return RECENT_TIME_REFRESH_INTERVAL_MS;
    }

    const elapsedMs = Math.max(0, now - timestamp);

    if (elapsedMs < RECENT_TIME_JUST_NOW_DURATION_MS) {
        return RECENT_TIME_JUST_NOW_DURATION_MS - elapsedMs;
    }

    const msPastMinute = elapsedMs % RECENT_TIME_REFRESH_INTERVAL_MS;

    return msPastMinute === 0 ? RECENT_TIME_REFRESH_INTERVAL_MS : RECENT_TIME_REFRESH_INTERVAL_MS - msPastMinute;
}
