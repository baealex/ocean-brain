import { describe, expect, it } from 'vitest';

import { isSupportedImageUploadType, SUPPORTED_IMAGE_UPLOAD_TYPES } from './image-upload-policy';

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
});
