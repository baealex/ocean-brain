import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FileEmbeddingApiKeyStore } from './embedding-api-key-store.js';

test('persists an embedding API key in a server-only file and supports removal', (t) => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-embedding-key-'));
    const filePath = path.join(directory, 'embedding-api-key');
    t.after(() => rmSync(directory, { recursive: true, force: true }));

    const store = new FileEmbeddingApiKeyStore(filePath);
    store.set(' provider-secret ');

    assert.equal(store.get(), 'provider-secret');
    assert.equal(new FileEmbeddingApiKeyStore(filePath).get(), 'provider-secret');
    assert.equal(readFileSync(filePath, 'utf8'), 'provider-secret');
    assert.equal(statSync(filePath).mode & 0o777, 0o600);

    store.set();
    assert.equal(store.get(), undefined);
    assert.equal(new FileEmbeddingApiKeyStore(filePath).get(), undefined);
});
