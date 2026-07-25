import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageDeleteService, resolveStoredImagePath } from './delete.js';

test('resolveStoredImagePath strips the public prefix', () => {
    const resolvedPath = resolveStoredImagePath('/assets/images/2026/4/15/sample.png');

    assert.equal(resolvedPath.endsWith('/images/2026/4/15/sample.png'), true);
});

test('resolveStoredImagePath rejects non-canonical and escaping image URLs', () => {
    const invalidUrls = [
        '/assets/images/',
        '/assets/images/../../outside.txt',
        '/assets/images/%2e%2e/%2e%2e/outside.txt',
        '/assets/images//etc/passwd',
        '/assets/images/2026/./sample.png',
        '/assets/images/2026\\..\\..\\outside.txt',
        '/assets/images/2026%5c..%5c..%5coutside.txt',
        '/assets/images/sample.png?download=true',
        '/assets/images/sample.png#preview',
        '/assets/images/%E0%A4%A',
        '/other/assets/images/sample.png',
    ];

    for (const url of invalidUrls) {
        assert.throws(() => resolveStoredImagePath(url), /inside the image directory/);
    }
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

test('image delete service preserves the file and row when the stored URL escapes the image directory', async () => {
    let fileChecked = false;
    let fileRemoved = false;
    let rowDeleted = false;

    const service = createImageDeleteService({
        deleteImageRecord: async () => {
            rowDeleted = true;
        },
        fileExists: () => {
            fileChecked = true;
            return true;
        },
        findImageById: async () => ({
            id: 9,
            url: '/assets/images/../../outside.txt',
        }),
        removeFile: async () => {
            fileRemoved = true;
        },
        resolveImagePath: resolveStoredImagePath,
    });

    await assert.rejects(() => service.deleteImageById(9), /inside the image directory/);
    assert.equal(fileChecked, false);
    assert.equal(fileRemoved, false);
    assert.equal(rowDeleted, false);
});
