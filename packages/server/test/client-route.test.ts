import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import express from 'express';

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

    const server = express()
        .use(createClientRouter({ mode: 'open' }))
        .listen(0);

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    t.after(() => server.close());

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/12`, {
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

    const server = express()
        .use(createClientRouter({ mode: 'open' }))
        .listen(0);

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    t.after(() => server.close());

    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
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
    const server = express()
        .use(
            createClientRouter({ mode: 'open' }, (_req, res) => {
                res.status(200).send('Development client');
            }),
        )
        .listen(0);

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    t.after(() => server.close());

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/notes`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'Development client');
});
