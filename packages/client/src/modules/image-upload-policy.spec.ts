import { describe, expect, it } from 'vitest';

import {
    getSupportedImageFileExtension,
    isSupportedImageUploadType,
    SUPPORTED_IMAGE_UPLOAD_TYPES,
} from './image-upload-policy';

describe('image upload policy', () => {
    it('allows the supported raster image types', () => {
        for (const type of SUPPORTED_IMAGE_UPLOAD_TYPES) {
            expect(isSupportedImageUploadType(type)).toBe(true);
        }
    });

    it('rejects SVG and unknown image types before upload', () => {
        expect(isSupportedImageUploadType('image/svg+xml')).toBe(false);
        expect(isSupportedImageUploadType('image/heic')).toBe(false);
        expect(isSupportedImageUploadType('')).toBe(false);
    });

    it('provides canonical file extensions for supported image types', () => {
        expect(
            Object.fromEntries(
                SUPPORTED_IMAGE_UPLOAD_TYPES.map((type) => [type, getSupportedImageFileExtension(type)]),
            ),
        ).toEqual({
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
            'image/avif': 'avif',
        });
        expect(getSupportedImageFileExtension('image/svg+xml')).toBeUndefined();
    });
});
