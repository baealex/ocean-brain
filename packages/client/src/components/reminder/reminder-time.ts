const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const joinUnits = (major: string, minor: string | null) => (minor ? `${major} ${minor}` : major);

export function isReminderOverdue(reminderTime: number, now = Date.now()) {
    return reminderTime < now;
}

export function formatReminderTimeRemaining(reminderTime: number, now = Date.now()) {
    const remainingMs = reminderTime - now;

    if (remainingMs < 0) {
        return 'Overdue';
    }

    if (remainingMs < MINUTE_MS) {
        return '<1m remaining';
    }

    if (remainingMs >= DAY_MS) {
        const days = Math.floor(remainingMs / DAY_MS);
        const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);

        return `${joinUnits(`${days}d`, hours ? `${hours}h` : null)} remaining`;
    }

    const hours = Math.floor(remainingMs / HOUR_MS);
    const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS);

    if (!hours) {
        return `${minutes}m remaining`;
    }

    return `${joinUnits(`${hours}h`, minutes ? `${minutes}m` : null)} remaining`;
}
