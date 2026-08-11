export const SUPPORTED_IMAGE_UPLOAD_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/avif',
] as const;

const SUPPORTED_IMAGE_UPLOAD_TYPE_SET = new Set<string>(SUPPORTED_IMAGE_UPLOAD_TYPES);
const IMAGE_FILE_EXTENSION_BY_TYPE = new Map<string, string>([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
    ['image/bmp', 'bmp'],
    ['image/avif', 'avif'],
]);

export const UNSUPPORTED_IMAGE_UPLOAD_MESSAGE = 'Unsupported image type. Use PNG, JPEG, GIF, WebP, BMP, or AVIF.';
export const FAILED_IMAGE_UPLOAD_MESSAGE = 'Failed to upload image.';

export const isSupportedImageUploadType = (type: string) => SUPPORTED_IMAGE_UPLOAD_TYPE_SET.has(type);

export const getSupportedImageFileExtension = (type: string) => IMAGE_FILE_EXTENSION_BY_TYPE.get(type);
