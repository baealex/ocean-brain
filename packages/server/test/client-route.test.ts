import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import Fastify from 'fastify';

import { paths } from '../src/paths.js';
import { createClientRouter } from '../src/routes/client.js';

test('serves direct client routes when the package path contains a dot directory', async (t: TestContext) => {
    const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-client-route-'));
    const clientDist = path.join(fixtureRoot, '.npm-cache', 'client', 'dist');
    const originalClientDist = paths.clientDist;

    mkdirSync(clientDist, { recursive: true });
    writeFileSync(path.join(clientDist, 'index.html'), '<main id="root">Ocean Brain</main>');
    paths.clientDist = clientDist;

    t.after(() => {
        paths.clientDist = originalClientDist;
        rmSync(fixtureRoot, { recursive: true, force: true });
    });

    const app = Fastify({ logger: false });
    app.register(createClientRouter({ mode: 'open' }));
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });

    t.after(() => app.close());

    const response = await fetch(`${baseUrl}/12`, {
        headers: { Accept: 'text/html' },
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<main id="root">Ocean Brain</main>');
});

test('does not serve the SPA document for missing assets or non-document requests', async (t: TestContext) => {
    const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-client-route-'));
    const clientDist = path.join(fixtureRoot, 'client', 'dist');
    const originalClientDist = paths.clientDist;

    mkdirSync(clientDist, { recursive: true });
    writeFileSync(path.join(clientDist, 'index.html'), '<main id="root">Ocean Brain</main>');
    paths.clientDist = clientDist;

    t.after(() => {
        paths.clientDist = originalClientDist;
        rmSync(fixtureRoot, { recursive: true, force: true });
    });

    const app = Fastify({ logger: false });
    app.register(createClientRouter({ mode: 'open' }));
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });

    t.after(() => app.close());
    const [missingAsset, nonDocumentRoute] = await Promise.all([
        fetch(`${baseUrl}/assets/missing.js`, { headers: { Accept: 'text/html' } }),
        fetch(`${baseUrl}/notes`, { headers: { Accept: 'application/json' } }),
    ]);

    assert.equal(missingAsset.status, 404);
    assert.equal(missingAsset.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await missingAsset.text(), '');
    assert.equal(nonDocumentRoute.status, 404);
    assert.equal(await nonDocumentRoute.text(), '');
});

test('serves client routes through an injected content middleware', async (t: TestContext) => {
    const app = Fastify({ logger: false });
    app.register(
        createClientRouter({ mode: 'open' }, (_request, reply) => {
            return reply.status(200).send('Development client');
        }),
    );
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });

    t.after(() => app.close());

    const response = await fetch(`${baseUrl}/notes`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'Development client');
});
