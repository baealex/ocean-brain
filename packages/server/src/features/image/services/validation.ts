export type ImageValidationErrorCode = 'IMAGE_INVALID_CONTENT' | 'IMAGE_UNSUPPORTED_CONTENT_TYPE';

export class ImageValidationError extends Error {
    public readonly code: ImageValidationErrorCode;
    public readonly status: number;

    constructor(code: ImageValidationErrorCode, status: number, message: string) {
        super(message);
        this.name = 'ImageValidationError';
        this.code = code;
        this.status = status;
    }
}

interface ValidateImagePayloadInput {
    buffer: Buffer;
    contentType: string;
}

export interface ValidatedImagePayload {
    buffer: Buffer;
    contentType: string;
    extension: string;
}

const SUPPORTED_IMAGE_TYPES = new Map([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
    ['image/bmp', 'bmp'],
    ['image/avif', 'avif'],
]);

const startsWithBytes = (buffer: Buffer, bytes: number[]) => {
    return bytes.every((byte, index) => buffer[index] === byte);
};

const readAscii = (buffer: Buffer, start: number, end: number) => {
    return buffer.subarray(start, end).toString('ascii');
};

const hasPngSignature = (buffer: Buffer) => {
    return buffer.length >= 8 && startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
};

const hasJpegSignature = (buffer: Buffer) => {
    return buffer.length >= 3 && startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
};

const hasGifSignature = (buffer: Buffer) => {
    return buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(readAscii(buffer, 0, 6));
};

const hasWebpSignature = (buffer: Buffer) => {
    return buffer.length >= 12 && readAscii(buffer, 0, 4) === 'RIFF' && readAscii(buffer, 8, 12) === 'WEBP';
};

const hasBmpSignature = (buffer: Buffer) => {
    return buffer.length >= 2 && readAscii(buffer, 0, 2) === 'BM';
};

const hasAvifSignature = (buffer: Buffer) => {
    if (buffer.length < 16 || readAscii(buffer, 4, 8) !== 'ftyp') {
        return false;
    }

    const ftypBoxSize = buffer.readUInt32BE(0);

    if (ftypBoxSize !== 0 && (ftypBoxSize < 16 || ftypBoxSize > buffer.length)) {
        return false;
    }

    const isAvifBrand = (brand: string) => brand === 'avif' || brand === 'avis';
    const majorBrand = readAscii(buffer, 8, 12);

    if (isAvifBrand(majorBrand)) {
        return true;
    }

    const boxEnd = ftypBoxSize === 0 ? buffer.length : ftypBoxSize;

    for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
        const brand = readAscii(buffer, offset, offset + 4);

        if (isAvifBrand(brand)) {
            return true;
        }
    }

    return false;
};

const hasExpectedImageSignature = (contentType: string, buffer: Buffer) => {
    switch (contentType) {
        case 'image/png':
            return hasPngSignature(buffer);
        case 'image/jpeg':
            return hasJpegSignature(buffer);
        case 'image/gif':
            return hasGifSignature(buffer);
        case 'image/webp':
            return hasWebpSignature(buffer);
        case 'image/bmp':
            return hasBmpSignature(buffer);
        case 'image/avif':
            return hasAvifSignature(buffer);
        default:
            return false;
    }
};

export const normalizeImageContentType = (contentType: string | null | undefined) => {
    return contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
};

export const getSupportedImageExtension = (contentType: string) => {
    return SUPPORTED_IMAGE_TYPES.get(normalizeImageContentType(contentType));
};

export const validateImagePayload = ({
    buffer,
    contentType: rawContentType,
}: ValidateImagePayloadInput): ValidatedImagePayload => {
    const contentType = normalizeImageContentType(rawContentType);
    const extension = SUPPORTED_IMAGE_TYPES.get(contentType);

    if (!extension) {
        throw new ImageValidationError('IMAGE_UNSUPPORTED_CONTENT_TYPE', 415, 'Image content type is not supported.');
    }

    const hasExpectedSignature = hasExpectedImageSignature(contentType, buffer);

    if (!hasExpectedSignature) {
        throw new ImageValidationError('IMAGE_INVALID_CONTENT', 415, 'Image content does not match the declared type.');
    }

    return {
        buffer,
        contentType,
        extension,
    };
};
