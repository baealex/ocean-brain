export const SUPPORTED_IMAGE_UPLOAD_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/avif',
] as const;

const SUPPORTED_IMAGE_UPLOAD_TYPE_SET = new Set<string>(SUPPORTED_IMAGE_UPLOAD_TYPES);

export const UNSUPPORTED_IMAGE_UPLOAD_MESSAGE = 'Unsupported image type. Use PNG, JPEG, GIF, WebP, BMP, or AVIF.';
export const FAILED_IMAGE_UPLOAD_MESSAGE = 'Failed to upload image.';

export const isSupportedImageUploadType = (type: string) => SUPPORTED_IMAGE_UPLOAD_TYPE_SET.has(type);
