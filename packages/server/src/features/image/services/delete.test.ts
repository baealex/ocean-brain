import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageDeleteService, resolveStoredImagePath } from './delete.js';

test('resolveStoredImagePath strips the public prefix', () => {
    const resolvedPath = resolveStoredImagePath('/assets/images/2026/4/15/sample.png');

    assert.equal(resolvedPath.endsWith('/images/2026/4/15/sample.png'), true);
});

test('image delete service returns false when the image does not exist', async () => {
    let deleted = false;

    const service = createImageDeleteService({
        deleteImageRecord: async () => {
            deleted = true;
        },
        fileExists: () => false,
        findImageById: async () => null,
        removeFile: async () => undefined,
        resolveImagePath: () => '/tmp/ignored.png',
    });

    const result = await service.deleteImageById(4);

    assert.equal(result, false);
    assert.equal(deleted, false);
});

test('image delete service removes the file before deleting the image row', async () => {
    const removed: string[] = [];
    const deleted: number[] = [];

    const service = createImageDeleteService({
        deleteImageRecord: async (id) => {
            deleted.push(id);
        },
        fileExists: () => true,
        findImageById: async () => ({
            id: 8,
            url: '/assets/images/2026/4/15/sample.png',
        }),
        removeFile: async (filePath) => {
            removed.push(filePath);
        },
        resolveImagePath: (url) => `/var/data${url}`,
    });

    const result = await service.deleteImageById(8);

    assert.equal(result, true);
    assert.deepEqual(removed, ['/var/data/assets/images/2026/4/15/sample.png']);
    assert.deepEqual(deleted, [8]);
});
