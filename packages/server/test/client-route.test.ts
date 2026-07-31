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
    const response = await fetch(`http://127.0.0.1:${port}/12`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<main id="root">Ocean Brain</main>');
});
