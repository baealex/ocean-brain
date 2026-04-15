import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageUploadService, hashImageBuffer } from './upload.js';

test('hashImageBuffer hashes raw bytes consistently', () => {
    const buffer = Buffer.from('same-image-bytes');

    assert.equal(hashImageBuffer(buffer), hashImageBuffer(Buffer.from('same-image-bytes')));
});

test('image upload service returns the existing image without writing a new file', async () => {
    let writeCount = 0;
    const service = createImageUploadService({
        createImage: async () => {
            throw new Error('create should not run');
        },
        ensureDir: async () => {
            throw new Error('ensureDir should not run');
        },
        findImageByHash: async () => ({
            id: 9,
            url: '/assets/images/existing.png',
        }),
        removeFile: async () => {
            throw new Error('remove should not run');
        },
        writeFile: async () => {
            writeCount += 1;
        },
    });

    const image = await service.persistImage({
        buffer: Buffer.from('existing-image'),
        extension: 'png',
    });

    assert.equal(writeCount, 0);
    assert.deepEqual(image, {
        id: 9,
        url: '/assets/images/existing.png',
    });
});

test('image upload service writes a file and creates an image row for a new image', async () => {
    const writes: Array<{ filePath: string; size: number }> = [];
    const created: Array<{ hash: string; url: string }> = [];

    const service = createImageUploadService({
        createImage: async (input) => {
            created.push(input);
            return {
                id: 12,
                url: input.url,
            };
        },
        ensureDir: async () => undefined,
        findImageByHash: async () => null,
        removeFile: async () => undefined,
        writeFile: async (filePath, buffer) => {
            writes.push({
                filePath,
                size: buffer.length,
            });
        },
    });

    const image = await service.persistImage({
        buffer: Buffer.from('brand-new-image'),
        extension: 'png',
    });

    assert.equal(writes.length, 1);
    assert.equal(created.length, 1);
    assert.match(created[0]?.url ?? '', /\/assets\/images\/\d+\/\d+\/\d+\/[a-f0-9]+\.png$/);
    assert.deepEqual(image, {
        id: 12,
        url: created[0]?.url,
    });
});

test('image upload service removes the file and returns the winning row on hash uniqueness conflicts', async () => {
    const removed: string[] = [];
    const hash = hashImageBuffer(Buffer.from('race-image'));
    let lookupCount = 0;

    const service = createImageUploadService({
        createImage: async () => {
            throw {
                code: 'P2002',
                meta: { target: ['hash'] },
            };
        },
        ensureDir: async () => undefined,
        findImageByHash: async () => {
            lookupCount += 1;

            if (lookupCount === 1) {
                return null;
            }

            return {
                id: 15,
                url: `/assets/images/2026/3/31/${hash}.png`,
            };
        },
        removeFile: async (filePath) => {
            removed.push(filePath);
        },
        writeFile: async () => undefined,
    });

    const image = await service.persistImage({
        buffer: Buffer.from('race-image'),
        extension: 'png',
    });

    assert.equal(removed.length, 1);
    assert.deepEqual(image, {
        id: 15,
        url: `/assets/images/2026/3/31/${hash}.png`,
    });
});

test('image upload service removes the file before surfacing non-unique create failures', async () => {
    const removed: string[] = [];
    const service = createImageUploadService({
        createImage: async () => {
            throw new Error('database down');
        },
        ensureDir: async () => undefined,
        findImageByHash: async () => null,
        removeFile: async (filePath) => {
            removed.push(filePath);
        },
        writeFile: async () => undefined,
    });

    await assert.rejects(
        () =>
            service.persistImage({
                buffer: Buffer.from('broken-image'),
                extension: 'png',
            }),
        /database down/,
    );

    assert.equal(removed.length, 1);
});
