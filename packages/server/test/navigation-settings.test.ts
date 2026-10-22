import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import {
    createDeleteCacheMutationResolver,
    createSetCacheMutationResolver,
} from '../src/features/cache/graphql/cache.mutation.resolver.js';
import { createIntegrationService } from '../src/features/integration/service.js';
import { createNavigationService, NAVIGATION_SETTINGS_KEY } from '../src/features/navigation/service.js';
import models from '../src/models.js';
import { AUTH_SESSION_COOKIE_NAME } from '../src/modules/auth-mode.js';

const openAuth = { mode: 'open', cookieName: AUTH_SESSION_COOKIE_NAME, source: 'explicit-open' } as const;
const preferences = { schemaVersion: 1, order: ['core:notes', 'core:search'], hiddenCoreIds: ['core:graph'] };
const manifest = {
    schemaVersion: 1,
    apiVersion: 1,
    id: 'example.navigation',
    name: 'Inbox',
    version: '1.0.0',
    description: 'Example app',
    permissions: [],
    launch: { url: 'https://example.com', mode: 'iframe' },
};

test('menu settings use defaults without writing and persist overrides without a schema migration', async (t) => {
    const app = createApp(openAuth, { logger: false });
    t.after(() => app.close());
    const get = () => app.inject({ url: '/api/navigation-settings' });
    assert.deepEqual((await get()).json(), { preferences: null, revision: null, status: 'ready' });
    assert.equal(await models.cache.count({ where: { key: NAVIGATION_SETTINGS_KEY } }), 0);
    const saved = await app.inject({
        method: 'PUT',
        url: '/api/navigation-settings',
        payload: {
            expectedRevision: null,
            preferences: { ...preferences, hiddenCoreIds: ['core:graph', 'core:settings'] },
        },
    });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.deepEqual(saved.json().preferences, preferences);
    assert.deepEqual(await createNavigationService().get(), saved.json());
    const stale = await app.inject({
        method: 'PUT',
        url: '/api/navigation-settings',
        payload: { expectedRevision: null, preferences },
    });
    assert.equal(stale.statusCode, 409);
    const reset = await app.inject({
        method: 'PUT',
        url: '/api/navigation-settings',
        payload: { expectedRevision: saved.json().revision, preferences: null },
    });
    assert.equal(reset.statusCode, 200);
    assert.deepEqual((await get()).json(), { preferences: null, revision: null, status: 'ready' });
    assert.equal(await models.cache.count({ where: { key: NAVIGATION_SETTINGS_KEY } }), 0);
});

test('menu order and existing app pins commit together and roll back on stale app state', async () => {
    const service = createNavigationService();
    const integrations = createIntegrationService();
    const first = await integrations.connect({ manifest });
    const second = await integrations.connect({ manifest });
    const saved = await service.save({
        expectedRevision: null,
        preferences,
        pins: [
            {
                id: first.id,
                pinned: true,
                expectedUpdatedAt: first.updatedAt,
            },
        ],
    });
    assert.equal((await integrations.get(first.id)).pinned, true);
    const updatedFirst = await integrations.get(first.id);
    await assert.rejects(
        service.save({
            expectedRevision: saved.revision,
            preferences: { ...preferences, order: [] },
            pins: [
                { id: first.id, pinned: false, expectedUpdatedAt: updatedFirst.updatedAt },
                { id: second.id, pinned: true, expectedUpdatedAt: '2000-01-01T00:00:00.000Z' },
            ],
        }),
        /changed/,
    );
    assert.equal((await integrations.get(first.id)).pinned, true);
    assert.deepEqual((await service.get()).preferences, preferences);
    await integrations.update(first.id, { enabled: true });
    await integrations.update(first.id, { enabled: false });
    assert.equal((await integrations.get(first.id)).pinned, true);
    await service.save({ expectedRevision: saved.revision, preferences: null });
    assert.equal((await integrations.get(first.id)).pinned, true);
});

test('compatible unknown fields survive edits; damaged and future settings are not overwritten on read', async () => {
    const service = createNavigationService();
    await models.cache.create({
        data: {
            key: NAVIGATION_SETTINGS_KEY,
            value: JSON.stringify({
                ...preferences,
                futureOption: { value: true },
                order: ['core:new-menu', ...preferences.order],
            }),
        },
    });
    const previous = await service.get();
    const saved = await service.save({ expectedRevision: previous.revision, preferences });
    assert.deepEqual(saved.preferences?.futureOption, { value: true });
    for (const raw of ['broken JSON', JSON.stringify({ schemaVersion: 2, futureOption: true })]) {
        await models.cache.update({ where: { key: NAVIGATION_SETTINGS_KEY }, data: { value: raw } });
        const state = await service.get();
        assert.equal(state.preferences, null);
        assert.equal(state.status, raw === 'broken JSON' ? 'invalid' : 'unsupported');
        assert.equal((await models.cache.findUniqueOrThrow({ where: { key: NAVIGATION_SETTINGS_KEY } })).value, raw);
        await assert.rejects(service.save({ expectedRevision: state.revision, preferences }));
    }
    await models.cache.update({ where: { key: NAVIGATION_SETTINGS_KEY }, data: { value: 'broken JSON' } });
    const broken = await service.get();
    assert.equal((await service.save({ expectedRevision: broken.revision, preferences: null })).status, 'ready');
});

test('menu writes reject malformed settings, opaque origins, and generic cache mutations', async (t) => {
    const app = createApp(openAuth, { logger: false });
    t.after(() => app.close());
    for (const invalid of [
        null,
        {},
        { ...preferences, order: ['core:notes', 'core:notes'] },
        { ...preferences, hiddenCoreIds: ['integration:app'] },
        { ...preferences, order: [23] },
    ]) {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/navigation-settings',
            payload: { expectedRevision: null, preferences: invalid, pins: 'bad' },
        });
        assert.equal(response.statusCode, 400, response.body);
    }
    const denied = await app.inject({
        method: 'PUT',
        url: '/api/navigation-settings',
        headers: { origin: 'null' },
        payload: { expectedRevision: null, preferences },
    });
    assert.equal(denied.statusCode, 403);
    await assert.rejects(
        createSetCacheMutationResolver()(null, { key: NAVIGATION_SETTINGS_KEY, value: '{}' }),
        /menu settings/,
    );
    await assert.rejects(createDeleteCacheMutationResolver()(null, { key: NAVIGATION_SETTINGS_KEY }), /menu settings/);
});
