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

const compareAndSetSession = (store: TtlMemorySessionStore, sid: string, generation: string, data: Session) =>
    new Promise<void>((resolve, reject) => {
        store.compareAndSet(sid, generation, data, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });

for (const generation of [undefined, 'current-generation']) {
    test(`a matching ${generation ? 'explicit' : 'legacy'} generation permits updating a session`, async (t) => {
        const store = new TtlMemorySessionStore();
        t.after(() => store.stopPruning());
        const original = Object.assign(createSessionData(new Date(Date.now() + 60_000)), {
            ...(generation ? { __fastifySessionMetadata: { generation } } : {}),
        });
        await setSession(store, 'session', original);
        const updated = { ...original, authenticated: true } as Session;

        await compareAndSetSession(store, 'session', generation ?? 'session', updated);

        assert.equal((await getSession(store, 'session'))?.authenticated, true);
    });
}

for (const state of ['destroyed', 'expired', 'regenerated'] as const) {
    test(`a stale request cannot overwrite a ${state} session`, async (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 28) });
        const store = new TtlMemorySessionStore();
        t.after(() => store.stopPruning());
        const original = createSessionData(new Date(Date.now() + 60_000), true);
        await setSession(store, 'session', original);
        if (state === 'destroyed') store.destroy('session');
        if (state === 'expired') t.mock.timers.tick(60_001);
        if (state === 'regenerated') {
            await setSession(
                store,
                'session',
                Object.assign(createSessionData(new Date(Date.now() + 60_000)), {
                    __fastifySessionMetadata: { generation: 'replacement' },
                }),
            );
        }

        await assert.rejects(compareAndSetSession(store, 'session', 'session', original), { code: 'ENOENT' });

        const persisted = await getSession(store, 'session');
        if (state === 'regenerated') assert.equal(persisted?.authenticated, undefined);
        else assert.equal(persisted, null);
    });
}
