import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createIntegrationService } from '../src/features/integration/service.js';
import models from '../src/models.js';
import {
    OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER,
    resolveMcpCompatibilityVersion,
} from '../src/modules/app-version.js';
import { AUTH_SESSION_COOKIE_NAME } from '../src/modules/auth-mode.js';
import { subscribeServerEvents } from '../src/modules/server-events.js';

const manifest = {
    schemaVersion: 1,
    apiVersion: 1,
    id: 'example.inbox',
    name: 'Inbox',
    version: '1.0.0',
    description: 'Example note capture.',
    permissions: ['notes:read', 'notes:create', 'notes:update', 'notes:delete'],
};
const openAuth = { mode: 'open', cookieName: AUTH_SESSION_COOKIE_NAME, source: 'explicit-open' } as const;

test('external integration API enforces grants, keeps browser/admin APIs private and reports authored events', async (t) => {
    const app = createApp(openAuth, { logger: false });
    t.after(() => app.close());
    const service = createIntegrationService();
    const connected = await app.inject({
        method: 'POST',
        url: '/api/integration-admin/connections',
        payload: { manifest, grantedPermissions: ['notes:read'] },
    });
    assert.equal(connected.statusCode, 201);
    const id = connected.json().id;
    t.after(() => service.disconnect(id));
    const issued = await app.inject({ method: 'POST', url: `/api/integration-admin/connections/${id}/token/rotate` });
    const headers = { authorization: `Bearer ${issued.json().token}` };
    const query = { query: '{ allNotes(pagination: {limit: 5, offset: 0}) { totalCount notes { id title } } }' };
    assert.equal(
        (await app.inject({ method: 'POST', url: '/api/integrations/v1/graphql', headers, payload: query })).statusCode,
        403,
    );
    await service.update(id, { enabled: true });
    const read = await app.inject({ method: 'POST', url: '/api/integrations/v1/graphql', headers, payload: query });
    assert.equal(read.statusCode, 200);
    assert.ok(read.json().data.allNotes);
    for (const route of ['create', 'metadata', 'patch-markdown', 'append-markdown', 'replace-markdown', 'delete']) {
        const denied = await app.inject({
            method: 'POST',
            url: `/api/integrations/v1/notes/${route}`,
            headers,
            payload: { id: '1', title: 'must not write' },
        });
        assert.equal(denied.statusCode, 403, route);
        assert.equal(denied.json().code, 'INTEGRATION_PERMISSION_DENIED');
    }
    for (const deniedQuery of [
        '{ cache(key: "MCP_ENABLED") { value } }',
        'mutation { deleteNote(id: "1") }',
        '{ alias: cache(key: "MCP_ENABLED") { value } }',
    ]) {
        const denied = await app.inject({
            method: 'POST',
            url: '/api/integrations/v1/graphql',
            headers,
            payload: { query: deniedQuery },
        });
        assert.ok(denied.json().errors);
        assert.ok(!denied.json().data);
    }
    await service.update(id, { grantedPermissions: ['notes:read', 'notes:create'] });
    const events: unknown[] = [];
    const unsubscribe = subscribeServerEvents((event) => events.push(event));
    t.after(unsubscribe);
    const created = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/notes/create',
        headers,
        payload: { title: 'Integration inbox contract', markdown: 'Captured by external integration.' },
    });
    assert.equal(created.statusCode, 200);
    const noteId = created.json().note.id;
    assert.ok(events.some((event) => JSON.stringify(event).includes('integration.note.created')));
    const before = await models.note.findUniqueOrThrow({ where: { id: Number(noteId) } });
    const noteRead = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/graphql',
        headers,
        payload: {
            query: 'query ($id: ID!) { noteRead(id: $id) { note { id title } markdown } }',
            variables: { id: noteId },
        },
    });
    assert.match(noteRead.json().data.noteRead.markdown, /Captured/);
    assert.equal(
        (await models.note.findUniqueOrThrow({ where: { id: Number(noteId) } })).updatedAt.getTime(),
        before.updatedAt.getTime(),
    );
    await service.update(id, { grantedPermissions: manifest.permissions });
    const updated = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/notes/metadata',
        headers,
        payload: { id: noteId, expectedUpdatedAt: before.updatedAt.toISOString(), title: 'Updated by integration' },
    });
    assert.equal(updated.json().status, 'applied');
    const deleted = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/notes/delete',
        headers,
        payload: { id: noteId },
    });
    assert.equal(deleted.json().deleted, true);
    assert.equal(await models.note.findUnique({ where: { id: Number(noteId) } }), null);
    await service.revokeToken(id);
    assert.equal(
        (await app.inject({ method: 'POST', url: '/api/integrations/v1/graphql', headers, payload: query })).statusCode,
        403,
    );
});

test('native MCP uses the same grants on common and legacy URLs', async (t) => {
    const app = createApp(openAuth, { logger: false });
    t.after(() => app.close());
    const service = createIntegrationService();
    await service.update('mcp', { enabled: true, grantedPermissions: ['notes:read'] });
    const issued = await service.rotateToken('mcp');
    const headers = {
        authorization: `Bearer ${issued.token}`,
        [OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER]: resolveMcpCompatibilityVersion(),
    };
    for (const url of ['/api/integrations/v1/graphql', '/graphql/mcp']) {
        const read = await app.inject({
            method: 'POST',
            url,
            headers,
            payload: { query: '{ allTags { totalCount } }' },
        });
        assert.equal(read.statusCode, 200);
        assert.ok(read.json().data.allTags);
    }
    for (const prefix of ['/api/integrations/v1', '/api/mcp']) {
        for (const route of ['create', 'metadata', 'patch-markdown', 'append-markdown', 'replace-markdown', 'delete']) {
            const denied = await app.inject({ method: 'POST', url: `${prefix}/notes/${route}`, headers, payload: {} });
            assert.equal(denied.statusCode, 403, `${prefix}/${route}`);
        }
    }
    const external = await service.connect({ manifest, grantedPermissions: ['notes:read'] });
    await service.update(external.id, { enabled: true });
    t.after(() => service.disconnect(external.id));
    const externalToken = await service.rotateToken(external.id);
    const spoofed = await app.inject({
        method: 'POST',
        url: '/graphql/mcp',
        headers: { ...headers, authorization: `Bearer ${externalToken.token}` },
        payload: { query: '{ allTags { totalCount } }' },
    });
    assert.equal(spoofed.statusCode, 403);
    const missingVersion = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/graphql',
        headers: { authorization: headers.authorization },
        payload: { query: '{ allTags { totalCount } }' },
    });
    assert.equal(missingVersion.statusCode, 426);
});

test('an integration bearer token cannot administer integrations or use browser session APIs', async (t) => {
    const app = createApp(
        {
            mode: 'password',
            password: 'secret',
            sessionSecret: 'integration-test-secret-1234567890123456',
            cookieName: AUTH_SESSION_COOKIE_NAME,
            source: 'password',
        },
        { logger: false },
    );
    t.after(() => app.close());
    const service = createIntegrationService();
    const integration = await service.connect({ manifest, grantedPermissions: manifest.permissions });
    t.after(() => service.disconnect(integration.id));
    await service.update(integration.id, { enabled: true });
    const { token } = await service.rotateToken(integration.id);
    const headers = { authorization: `Bearer ${token}` };
    assert.equal((await app.inject({ url: '/api/integration-admin/connections', headers })).statusCode, 401);
    assert.equal(
        (
            await app.inject({
                method: 'PATCH',
                url: `/api/integration-admin/connections/${integration.id}`,
                headers,
                payload: { grantedPermissions: [] },
            })
        ).statusCode,
        401,
    );
    const browser = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers,
        payload: { query: '{ allTags { totalCount } }' },
    });
    assert.equal(browser.statusCode, 401);
});

test('embedded integration pages cannot use owner write APIs in open mode', async (t) => {
    const app = createApp(openAuth, { logger: false });
    t.after(() => app.close());
    for (const origin of ['null', 'https://untrusted.example']) {
        const write = await app.inject({
            method: 'POST',
            url: '/graphql',
            headers: { origin },
            payload: { query: 'mutation { deleteNote(id: "1") }' },
        });
        assert.equal(write.statusCode, 403);
        const connect = await app.inject({
            method: 'POST',
            url: '/api/integration-admin/connections',
            headers: { origin },
            payload: { manifest, grantedPermissions: manifest.permissions },
        });
        assert.equal(connect.statusCode, 403);
    }
});

test('integration note reads preserve canonical content and version when a reference title is stale', async (t) => {
    const app = createApp(openAuth, { logger: false });
    t.after(() => app.close());
    const service = createIntegrationService();
    const connection = await service.connect({ manifest, grantedPermissions: ['notes:read'] });
    await service.update(connection.id, { enabled: true });
    const { token } = await service.rotateToken(connection.id);
    const target = await models.note.create({ data: { title: 'Renamed target', content: '[]' } });
    const content = JSON.stringify([
        {
            id: 'paragraph',
            type: 'paragraph',
            props: {},
            content: [{ type: 'reference', props: { id: String(target.id), title: 'Old target' } }],
            children: [],
        },
    ]);
    const source = await models.note.create({ data: { title: 'Source', content } });
    const read = await app.inject({
        method: 'POST',
        url: '/api/integrations/v1/graphql',
        headers: { authorization: `Bearer ${token}` },
        payload: {
            query: 'query ($id: ID!) { note(id: $id) { content updatedAt } noteRead(id: $id) { markdown note { updatedAt } } }',
            variables: { id: String(source.id) },
        },
    });
    assert.ok(!read.json().errors, JSON.stringify(read.json().errors));
    assert.equal(read.json().data.note.content, content);
    const unchanged = await models.note.findUniqueOrThrow({ where: { id: source.id } });
    assert.equal(unchanged.content, content);
    assert.equal(unchanged.updatedAt.getTime(), source.updatedAt.getTime());
});
