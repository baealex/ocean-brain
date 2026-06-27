import session, { type SessionData } from 'express-session';

export const AUTH_SESSION_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
export const ANONYMOUS_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const AUTH_SESSION_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 1000;

type StoredSession = {
    data: string;
    expiresAt: number;
    authenticated: boolean;
    updatedAt: number;
};

type AuthSessionData = SessionData & {
    authenticated?: boolean;
};

const serializeSession = (data: SessionData) => JSON.stringify(data);

const deserializeSession = (data: string): SessionData => {
    const parsed = JSON.parse(data) as SessionData;
    const expires = parsed.cookie?.expires;

    if (typeof expires === 'string') {
        parsed.cookie.expires = new Date(expires);
    }

    return parsed;
};

const isAuthenticatedSession = (data: SessionData) => Boolean((data as AuthSessionData).authenticated);

const getSessionExpiry = (data: SessionData, now = Date.now()) => {
    const expires = data.cookie?.expires;
    const ttlMs = isAuthenticatedSession(data) ? AUTH_SESSION_IDLE_TIMEOUT_MS : ANONYMOUS_SESSION_IDLE_TIMEOUT_MS;
    const fallbackExpiresAt = now + ttlMs;

    if (expires) {
        const expiresAt = expires instanceof Date ? expires : new Date(expires);

        if (!Number.isNaN(expiresAt.getTime())) {
            return Math.min(expiresAt.getTime(), fallbackExpiresAt);
        }
    }

    return fallbackExpiresAt;
};

export class TtlMemorySessionStore extends session.Store {
    private readonly sessions = new Map<string, StoredSession>();
    private readonly pruneTimer: NodeJS.Timeout;

    constructor(private readonly options: { maxSessions?: number; pruneIntervalMs?: number } = {}) {
        super();

        this.pruneTimer = setInterval(() => {
            this.pruneExpiredSessions();
        }, options.pruneIntervalMs ?? AUTH_SESSION_PRUNE_INTERVAL_MS);
        this.pruneTimer.unref?.();
    }

    get(sid: string, callback: (error: unknown, session?: SessionData | null) => void) {
        try {
            const entry = this.sessions.get(sid);

            if (!entry) {
                callback(null, null);
                return;
            }

            if (entry.expiresAt <= Date.now()) {
                this.sessions.delete(sid);
                callback(null, null);
                return;
            }

            callback(null, deserializeSession(entry.data));
        } catch (error) {
            callback(error);
        }
    }

    set(sid: string, data: SessionData, callback?: (error?: unknown) => void) {
        try {
            const now = Date.now();

            this.sessions.set(sid, {
                data: serializeSession(data),
                expiresAt: getSessionExpiry(data, now),
                authenticated: isAuthenticatedSession(data),
                updatedAt: now,
            });
            this.pruneExpiredSessions();
            this.evictOldestSessions();
            callback?.();
        } catch (error) {
            callback?.(error);
        }
    }

    destroy(sid: string, callback?: (error?: unknown) => void) {
        this.sessions.delete(sid);
        callback?.();
    }

    touch(sid: string, data: SessionData, callback?: () => void) {
        const entry = this.sessions.get(sid);

        if (entry) {
            const now = Date.now();

            this.sessions.set(sid, {
                data: serializeSession(data),
                expiresAt: getSessionExpiry(data, now),
                authenticated: isAuthenticatedSession(data),
                updatedAt: now,
            });
        }

        callback?.();
    }

    all(callback: (error: unknown, sessions?: SessionData[] | { [sid: string]: SessionData } | null) => void) {
        try {
            this.pruneExpiredSessions();

            const sessions: Record<string, SessionData> = {};
            for (const [sid, entry] of this.sessions) {
                sessions[sid] = deserializeSession(entry.data);
            }

            callback(null, sessions);
        } catch (error) {
            callback(error);
        }
    }

    length(callback: (error: unknown, length?: number) => void) {
        this.pruneExpiredSessions();
        callback(null, this.sessions.size);
    }

    clear(callback?: (error?: unknown) => void) {
        this.sessions.clear();
        callback?.();
    }

    pruneExpiredSessions(now = Date.now()) {
        for (const [sid, entry] of this.sessions) {
            if (entry.expiresAt <= now) {
                this.sessions.delete(sid);
            }
        }
    }

    stopPruning() {
        clearInterval(this.pruneTimer);
    }

    private evictOldestSessions() {
        const maxSessions = this.options.maxSessions ?? DEFAULT_MAX_SESSIONS;

        while (this.sessions.size > maxSessions) {
            const oldestSid = this.findOldestSessionId((entry) => !entry.authenticated) ?? this.findOldestSessionId();

            if (!oldestSid) {
                return;
            }

            this.sessions.delete(oldestSid);
        }
    }

    private findOldestSessionId(filter: (entry: StoredSession) => boolean = () => true) {
        let oldestSid: string | undefined;
        let oldestUpdatedAt = Number.POSITIVE_INFINITY;

        for (const [sid, entry] of this.sessions) {
            if (filter(entry) && entry.updatedAt < oldestUpdatedAt) {
                oldestSid = sid;
                oldestUpdatedAt = entry.updatedAt;
            }
        }

        return oldestSid;
    }
}

export const createSessionStore = (): session.Store => new TtlMemorySessionStore();
