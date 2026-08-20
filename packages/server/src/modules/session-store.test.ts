import assert from 'node:assert/strict';
import test from 'node:test';
import type { Session } from 'fastify';
import { TtlMemorySessionStore } from './session-store.js';

const createSessionData = (expires: Date, authenticated = false): Session =>
    ({
        cookie: { expires, originalMaxAge: null },
        ...(authenticated ? { authenticated: true } : {}),
    }) as Session;

const setSession = (store: TtlMemorySessionStore, sid: string, data: Session) =>
    new Promise<void>((resolve, reject) => {
        store.set(sid, data, (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });

const getSession = (store: TtlMemorySessionStore, sid: string) =>
    new Promise<Session | null | undefined>((resolve, reject) => {
        store.get(sid, (error, data) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(data);
        });
    });

test('pruneExpiredSessions removes orphaned sessions past their expiry', async () => {
    const store = new TtlMemorySessionStore({ pruneIntervalMs: 60_000 });

    try {
        await setSession(store, 'expired-session', createSessionData(new Date(Date.now() - 1000)));
        await setSession(store, 'active-session', createSessionData(new Date(Date.now() + 60_000)));

        store.pruneExpiredSessions();

        assert.equal(await getSession(store, 'expired-session'), null);
        assert.ok(await getSession(store, 'active-session'));
    } finally {
        store.stopPruning();
    }
});

test('ttl memory session store evicts oldest sessions over the cap', async () => {
    const store = new TtlMemorySessionStore({ maxSessions: 1, pruneIntervalMs: 60_000 });

    try {
        await setSession(store, 'old-session', createSessionData(new Date(Date.now() + 60_000)));
        await setSession(store, 'new-session', createSessionData(new Date(Date.now() + 60_000)));

        assert.equal(await getSession(store, 'old-session'), null);
        assert.ok(await getSession(store, 'new-session'));
    } finally {
        store.stopPruning();
    }
});

test('ttl memory session store evicts anonymous sessions before authenticated sessions', async () => {
    const store = new TtlMemorySessionStore({ maxSessions: 2, pruneIntervalMs: 60_000 });

    try {
        await setSession(store, 'authenticated-session', createSessionData(new Date(Date.now() + 60_000), true));
        await setSession(store, 'anonymous-session', createSessionData(new Date(Date.now() + 60_000)));
        await setSession(store, 'new-anonymous-session', createSessionData(new Date(Date.now() + 60_000)));

        assert.ok(await getSession(store, 'authenticated-session'));
        assert.equal(await getSession(store, 'anonymous-session'), null);
        assert.ok(await getSession(store, 'new-anonymous-session'));
    } finally {
        store.stopPruning();
    }
});
