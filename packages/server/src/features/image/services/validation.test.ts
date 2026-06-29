import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageValidationError, validateImagePayload } from './validation.js';

const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2O4evXqfwAIgQN/QHwrfwAAAABJRU5ErkJggg==',
    'base64',
);

const createWebpHeader = () => {
    return Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii')]);
};

const createFtypBox = (majorBrand: string, options: { compatibleBrands?: string[]; minorVersion?: Buffer } = {}) => {
    const minorVersion = options.minorVersion ?? Buffer.alloc(4);
    const compatibleBrands = options.compatibleBrands ?? [];
    const boxSize = 16 + compatibleBrands.length * 4;
    const buffer = Buffer.alloc(boxSize);

    buffer.writeUInt32BE(boxSize, 0);
    buffer.write('ftyp', 4, 'ascii');
    buffer.write(majorBrand, 8, 'ascii');
    minorVersion.copy(buffer, 12, 0, 4);

    compatibleBrands.forEach((brand, index) => {
        buffer.write(brand, 16 + index * 4, 'ascii');
    });

    return buffer;
};

const SUPPORTED_IMAGE_FIXTURES = [
    {
        buffer: PNG_BYTES,
        contentType: 'image/png; charset=binary',
        extension: 'png',
    },
    {
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        contentType: 'image/jpeg',
        extension: 'jpg',
    },
    {
        buffer: Buffer.from('GIF89a', 'ascii'),
        contentType: 'image/gif',
        extension: 'gif',
    },
    {
        buffer: createWebpHeader(),
        contentType: 'image/webp',
        extension: 'webp',
    },
    {
        buffer: Buffer.from('BM', 'ascii'),
        contentType: 'image/bmp',
        extension: 'bmp',
    },
    {
        buffer: createFtypBox('avif'),
        contentType: 'image/avif',
        extension: 'avif',
    },
];

for (const fixture of SUPPORTED_IMAGE_FIXTURES) {
    test(`validateImagePayload accepts ${fixture.contentType} content with a matching signature`, () => {
        const image = validateImagePayload({
            buffer: fixture.buffer,
            contentType: fixture.contentType,
        });

        assert.equal(image.contentType, fixture.contentType.split(';')[0]);
        assert.equal(image.extension, fixture.extension);
        assert.deepEqual(image.buffer, fixture.buffer);
    });
}

test('validateImagePayload accepts AVIF through a compatible brand', () => {
    const buffer = createFtypBox('isom', { compatibleBrands: ['avif'] });
    const image = validateImagePayload({
        buffer,
        contentType: 'image/avif',
    });

    assert.equal(image.extension, 'avif');
});

test('validateImagePayload rejects supported content types with mismatched bytes', () => {
    assert.throws(
        () =>
            validateImagePayload({
                buffer: Buffer.from('not-a-png'),
                contentType: 'image/png',
            }),
        (error: unknown) => {
            assert.ok(error instanceof ImageValidationError);
            assert.equal(error.code, 'IMAGE_INVALID_CONTENT');
            assert.equal(error.status, 415);
            return true;
        },
    );
});

test('validateImagePayload rejects AVIF false positives in the minor version field', () => {
    assert.throws(
        () =>
            validateImagePayload({
                buffer: createFtypBox('isom', { minorVersion: Buffer.from('avif', 'ascii') }),
                contentType: 'image/avif',
            }),
        (error: unknown) => {
            assert.ok(error instanceof ImageValidationError);
            assert.equal(error.code, 'IMAGE_INVALID_CONTENT');
            assert.equal(error.status, 415);
            return true;
        },
    );
});

test('validateImagePayload rejects AVIF brands outside the ftyp box', () => {
    assert.throws(
        () =>
            validateImagePayload({
                buffer: Buffer.concat([createFtypBox('isom'), Buffer.from('avif', 'ascii')]),
                contentType: 'image/avif',
            }),
        (error: unknown) => {
            assert.ok(error instanceof ImageValidationError);
            assert.equal(error.code, 'IMAGE_INVALID_CONTENT');
            assert.equal(error.status, 415);
            return true;
        },
    );
});

test('validateImagePayload rejects unsupported image content types', () => {
    assert.throws(
        () =>
            validateImagePayload({
                buffer: Buffer.from('<svg></svg>'),
                contentType: 'image/svg+xml',
            }),
        (error: unknown) => {
            assert.ok(error instanceof ImageValidationError);
            assert.equal(error.code, 'IMAGE_UNSUPPORTED_CONTENT_TYPE');
            assert.equal(error.status, 415);
            return true;
        },
    );
});
