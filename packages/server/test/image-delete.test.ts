import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { createImageDeleteService } from '../src/modules/image-delete.js';

test('image delete service returns a preview for an existing image', async () => {
    const service = createImageDeleteService({
        countReferences: async () => 2,
        deleteImageRecord: async () => undefined,
        fileExists: () => false,
        findImage: async () => ({
            id: 3,
            url: '/assets/images/2026/3/30/test.png'
        }),
        imageDir: 'C:/tmp/images',
        unlinkFile: () => undefined
    });

    const preview = await service.getDeletePreview(3);

    assert.deepEqual(preview, {
        id: '3',
        url: '/assets/images/2026/3/30/test.png',
        referenceCount: 2
    });
});

test('image delete service removes the file and deletes the image record', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-image-delete-'));
    const relativeUrl = '/assets/images/2026/3/30/test.png';
    const imagePath = path.resolve(tempDir, '2026/3/30/test.png');

    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, 'file-bytes', 'utf-8');

    const deletedIds: number[] = [];
    const service = createImageDeleteService({
        countReferences: async () => 1,
        deleteImageRecord: async (id) => {
            deletedIds.push(id);
        },
        fileExists: (filePath) => fs.existsSync(filePath),
        findImage: async () => ({
            id: 7,
            url: relativeUrl
        }),
        imageDir: tempDir,
        unlinkFile: (filePath) => fs.unlinkSync(filePath)
    });

    const deleted = await service.deleteImageById(7);

    assert.deepEqual(deleted, {
        id: '7',
        url: relativeUrl,
        referenceCount: 1
    });
    assert.deepEqual(deletedIds, [7]);
    assert.equal(fs.existsSync(imagePath), false);
});

test('image delete service returns null when the image does not exist', async () => {
    const service = createImageDeleteService({
        countReferences: async () => 0,
        deleteImageRecord: async () => undefined,
        fileExists: () => false,
        findImage: async () => null,
        imageDir: 'C:/tmp/images',
        unlinkFile: () => undefined
    });

    assert.equal(await service.deleteImageById(999), null);
});
