import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { issueMcpToken } from '~/modules/mcp-token.js';
import { type IntegrationManifest, parseIntegrationProxyUrl, parseManifest } from './manifest.js';
import { createIntegrationService } from './service.js';

const applyMigration = (db: DatabaseSync, name: string) =>
    db.exec(readFileSync(new URL(`../../../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8'));

const manifest: IntegrationManifest = {
    schemaVersion: 1,
    apiVersion: 1,
    id: 'example.notes',
    name: 'Note inbox',
    version: '1.0.0',
    description: 'Read and capture notes.',
    permissions: ['notes:read', 'notes:create'],
    launch: { url: 'http://127.0.0.1:7777', mode: 'iframe' },
};

test('connections keep independent credentials, grants, lifecycle and upgrade state', async () => {
    const service = createIntegrationService();
    const first = await service.connect({ manifest, grantedPermissions: ['notes:read'] });
    const second = await service.connect({ manifest, grantedPermissions: ['notes:read', 'notes:create'] });
    const a = await service.rotateToken(first.id);
    const b = await service.rotateToken(second.id);
    assert.equal(await service.authenticate(a.token), null);
    await service.update(first.id, { enabled: true });
    await service.update(second.id, { enabled: true });
    assert.deepEqual((await service.authenticate(a.token))?.permissions, ['notes:read']);
    assert.deepEqual((await service.authenticate(b.token))?.permissions, ['notes:read', 'notes:create']);
    await assert.rejects(service.update(first.id, { grantedPermissions: ['notes:delete'] }), /requested/);
    await assert.rejects(service.update(first.id, { grantedPermissions: ['notes:create'] }), /notes:read/);
    await assert.rejects(service.update(first.id, { enabled: 'true' }), /boolean/);
    await service.update(first.id, {
        manifest: { ...manifest, version: '2.0.0', permissions: [...manifest.permissions, 'notes:delete'] },
    });
    assert.deepEqual((await service.authenticate(a.token))?.permissions, ['notes:read']);
    await service.update(second.id, { manifest: { ...manifest, version: '2.0.0', permissions: ['notes:read'] } });
    assert.deepEqual((await service.authenticate(b.token))?.permissions, ['notes:read']);
    const rotated = await service.rotateToken(first.id);
    assert.equal(await service.authenticate(a.token), null);
    assert.ok(await service.authenticate(b.token));
    await service.revokeToken(first.id);
    assert.equal(await service.authenticate(rotated.token), null);
    assert.ok(await service.authenticate(b.token));
    assert.ok(!JSON.stringify(await service.list()).includes('tokenHash'));
    await service.disconnect(second.id);
    assert.equal(await service.authenticate(b.token), null);
    await service.disconnect(first.id);
    await assert.rejects(service.disconnect('mcp'), /cannot be disconnected/);
    await assert.rejects(service.update('mcp', { manifest }), /managed by Ocean Brain/);
    await assert.rejects(service.connect({ manifest: { ...manifest, id: 'ocean-brain.fake' } }), /reserved/);
});

test('manifest validation rejects incompatible contracts and unsafe entry URLs', () => {
    for (const url of [
        'javascript:alert(1)',
        'data:text/html,test',
        '/setting',
        'http://example.com/',
        'https://user:secret@example.com/',
    ]) {
        assert.throws(() => parseManifest({ ...manifest, launch: { mode: 'iframe', url } }));
    }
    assert.throws(() => parseManifest({ ...manifest, apiVersion: 2 }), /supported/);
    assert.throws(() => parseManifest({ ...manifest, schemaVersion: 2 }), /supported/);
    assert.throws(() => parseManifest({ ...manifest, permissions: ['admin'] }), /supported/);
    const parsedLaunch = parseManifest(manifest).launch;
    assert.ok(parsedLaunch && 'url' in parsedLaunch);
    assert.equal(parsedLaunch.url, 'http://127.0.0.1:7777/');
    assert.deepEqual(parseManifest({ ...manifest, launch: { mode: 'proxied' } }).launch, { mode: 'proxied' });
    assert.throws(
        () => parseManifest({ ...manifest, launch: { mode: 'proxied', url: 'https://example.com' } }),
        /cannot/,
    );
    assert.equal(parseIntegrationProxyUrl('http://elastic-search:7778/'), 'http://elastic-search:7778');
    for (const url of ['file:///tmp/app', 'http://user:secret@example.com', 'http://example.com/app', 'relative']) {
        assert.throws(() => parseIntegrationProxyUrl(url), /private app URL/i);
    }
});

test('proxied connections require a private URL without returning it to management clients', async () => {
    const service = createIntegrationService();
    const proxiedManifest: IntegrationManifest = { ...manifest, launch: { mode: 'proxied' } };

    await assert.rejects(service.connect({ manifest: proxiedManifest }), /private app URL/i);
    const connection = await service.connect({
        manifest: proxiedManifest,
        grantedPermissions: ['notes:read'],
        proxyUrl: 'http://127.0.0.1:7778/',
    });
    try {
        assert.equal(connection.proxyConfigured, true);
        assert.equal(JSON.stringify(connection).includes('127.0.0.1:7778'), false);
        await service.update(connection.id, { proxyUrl: 'http://elastic-search:7778' });
        await service.update(connection.id, { enabled: true });
        const direct = await service.update(connection.id, { manifest });
        assert.equal(direct.proxyConfigured, false);
        await assert.rejects(service.update(connection.id, { manifest: proxiedManifest }), /private app URL/i);
    } finally {
        await service.disconnect(connection.id);
    }
});

test('platform migration preserves enabled state and the latest active MCP credential', () => {
    const db = new DatabaseSync(':memory:');
    try {
        db.exec(
            'CREATE TABLE Cache (key TEXT, value TEXT); CREATE TABLE McpToken (id INTEGER, tokenHash TEXT, createdAt DATETIME, lastUsedAt DATETIME, revokedAt DATETIME);',
        );
        db.exec("INSERT INTO Cache VALUES ('MCP_ENABLED', 'true');");
        const old = issueMcpToken();
        const active = issueMcpToken();
        const insert = db.prepare('INSERT INTO McpToken VALUES (?, ?, ?, ?, ?)');
        insert.run(1, old.hash, '2026-01-01', null, null);
        insert.run(2, active.hash, '2026-01-02', '2026-01-03', null);
        insert.run(3, issueMcpToken().hash, '2026-01-04', null, '2026-01-05');
        applyMigration(db, '20260917120000_0020_plugin_installations');
        applyMigration(db, '20260917150000_0021_integration_connections');
        const connection = db.prepare('SELECT * FROM IntegrationConnection').get();
        assert.equal(connection?.enabled, 1);
        assert.equal(connection?.id, 'mcp');
        const credential = db.prepare('SELECT * FROM IntegrationCredential').get();
        assert.equal(credential?.tokenHash, active.hash);
        assert.equal(credential?.id, '2');
        assert.equal(credential?.connectionId, 'mcp');
        assert.equal(credential?.createdAt, '2026-01-02');
        assert.equal(credential?.lastUsedAt, '2026-01-03');
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM McpToken').get()?.count, 3);
    } finally {
        db.close();
    }
});

test('integration rename preserves existing external connections and enforces credential constraints', () => {
    const db = new DatabaseSync(':memory:');
    try {
        db.exec(`
            PRAGMA foreign_keys = ON;
            CREATE TABLE Cache (key TEXT, value TEXT);
            CREATE TABLE McpToken (id INTEGER, tokenHash TEXT, createdAt DATETIME, lastUsedAt DATETIME, revokedAt DATETIME);
        `);
        applyMigration(db, '20260917120000_0020_plugin_installations');
        db.prepare(`
            INSERT INTO PluginInstallation (id, pluginId, manifest, grantedPermissions, enabled, pinned, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 1, 1, ?, ?)
        `).run('existing-inbox', manifest.id, JSON.stringify(manifest), '["notes:read"]', '2026-01-01', '2026-01-02');
        const token = issueMcpToken();
        db.prepare(`
            INSERT INTO PluginCredential (installationId, id, tokenHash, createdAt, lastUsedAt) VALUES (?, ?, ?, ?, ?)
        `).run('existing-inbox', 'existing-credential', token.hash, '2026-01-03', '2026-01-04');
        const beforeConnections = db.prepare('SELECT * FROM PluginInstallation ORDER BY id').all();
        const beforeCredentials = db.prepare('SELECT * FROM PluginCredential ORDER BY installationId').all();

        applyMigration(db, '20260917150000_0021_integration_connections');

        assert.deepEqual(
            db
                .prepare('SELECT * FROM IntegrationConnection ORDER BY id')
                .all()
                .map((row) => ({ ...row })),
            beforeConnections.map(({ pluginId, ...row }) => ({ ...row, integrationId: pluginId })),
        );
        assert.deepEqual(
            db
                .prepare('SELECT * FROM IntegrationCredential ORDER BY connectionId')
                .all()
                .map((row) => ({ ...row })),
            beforeCredentials.map(({ installationId, ...row }) => ({ ...row, connectionId: installationId })),
        );
        assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
        assert.throws(
            () =>
                db
                    .prepare('INSERT INTO IntegrationCredential (connectionId, id, tokenHash) VALUES (?, ?, ?)')
                    .run('mcp', 'duplicate-token', token.hash),
            /UNIQUE constraint failed/,
        );
        assert.throws(
            () =>
                db
                    .prepare('INSERT INTO IntegrationCredential (connectionId, id, tokenHash) VALUES (?, ?, ?)')
                    .run('missing-connection', 'orphan', 'different-hash'),
            /FOREIGN KEY constraint failed/,
        );
        db.prepare('DELETE FROM IntegrationConnection WHERE id = ?').run('existing-inbox');
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM IntegrationCredential').get()?.count, 0);
    } finally {
        db.close();
    }
});

test('proxy migration disables legacy runner connections until a private URL is configured', () => {
    const db = new DatabaseSync(':memory:');
    try {
        db.exec(`
            CREATE TABLE Cache (key TEXT, value TEXT);
            CREATE TABLE McpToken (id INTEGER, tokenHash TEXT, createdAt DATETIME, lastUsedAt DATETIME, revokedAt DATETIME);
        `);
        applyMigration(db, '20260917120000_0020_plugin_installations');
        applyMigration(db, '20260917150000_0021_integration_connections');
        const legacyManifest = JSON.stringify({ ...manifest, launch: { mode: 'managed' } });
        db.prepare(`
            INSERT INTO IntegrationConnection (id, integrationId, manifest, enabled, updatedAt)
            VALUES (?, ?, ?, 1, ?)
        `).run('legacy-proxy', manifest.id, legacyManifest, '2026-09-19');

        applyMigration(db, '20260919090000_0022_integration_proxy_url');

        const migrated = db
            .prepare('SELECT manifest, proxyUrl, enabled FROM IntegrationConnection WHERE id = ?')
            .get('legacy-proxy');
        assert.equal(JSON.parse(String(migrated?.manifest)).launch.mode, 'proxied');
        assert.equal(migrated?.proxyUrl, null);
        assert.equal(migrated?.enabled, 0);
    } finally {
        db.close();
    }
});

test('native integration discovery is idempotent and preserves existing owner decisions', async () => {
    const service = createIntegrationService();
    await service.update('mcp', { enabled: true, grantedPermissions: ['notes:read'] });
    const { token } = await service.rotateToken('mcp');
    await service.ensureNativeConnections();
    await service.ensureNativeConnections();
    const native = await service.get('mcp');
    assert.equal(native.enabled, true);
    assert.deepEqual(native.grantedPermissions, ['notes:read']);
    assert.equal((await service.authenticate(token))?.connectionId, 'mcp');
    assert.equal((await service.list()).filter((integration) => integration.id === 'mcp').length, 1);
});
