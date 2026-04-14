export const NOTE_SNAPSHOT_RETENTION_DAYS = 14;
export const NOTE_SNAPSHOT_MAX_PER_NOTE = 10;
export const NOTE_TRASH_RETENTION_DAYS = 30;
export const RECOVERY_RETENTION_BATCH_LIMIT = 100;

export const SNAPSHOT_RETENTION_DAYS = NOTE_SNAPSHOT_RETENTION_DAYS;
export const SNAPSHOT_MAX_PER_NOTE = NOTE_SNAPSHOT_MAX_PER_NOTE;
export const TRASH_RETENTION_DAYS = NOTE_TRASH_RETENTION_DAYS;
export const RECOVERY_CLEANUP_BATCH_LIMIT = RECOVERY_RETENTION_BATCH_LIMIT;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const resolveRetentionCutoff = (retentionDays: number, now = new Date()) => {
    return new Date(now.getTime() - retentionDays * DAY_IN_MS);
};

export const createRetentionCutoff = resolveRetentionCutoff;
