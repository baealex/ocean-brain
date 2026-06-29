import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import { type PersistedImageSummary, type PersistImageInput, persistUploadedImage } from '../services/upload.js';
import { ImageValidationError, normalizeImageContentType, validateImagePayload } from '../services/validation.js';

type PersistImage = (input: PersistImageInput) => Promise<PersistedImageSummary>;

const IMAGE_DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i;

const createUploadResponse = (image: PersistedImageSummary) => {
    return {
        id: image.id,
        url: image.url,
    };
};

const parseImageDataUrl = (image: string) => {
    const match = IMAGE_DATA_URL_PATTERN.exec(image);

    if (!match || !match[2] || match[2].length % 4 !== 0) {
        return null;
    }

    return {
        base64: match[2],
        contentType: normalizeImageContentType(match[1]),
    };
};

const createUploadValidationError = (error: ImageValidationError) => {
    if (error.code === 'IMAGE_UNSUPPORTED_CONTENT_TYPE') {
        return createAppError(415, 'IMAGE_UPLOAD_UNSUPPORTED_TYPE', 'Uploaded image content type is not supported.');
    }

    return createAppError(400, 'INVALID_IMAGE_UPLOAD', 'Uploaded image content is invalid.');
};

export const createUploadImageHandler = (persistImage: PersistImage = persistUploadedImage): Controller => {
    return async (req, res) => {
        const { image } = req.body ?? {};

        if (typeof image !== 'string') {
            throw createAppError(400, 'INVALID_IMAGE_UPLOAD', 'No image uploaded');
        }

        const parsedImage = parseImageDataUrl(image);

        if (!parsedImage) {
            throw createAppError(400, 'INVALID_IMAGE_UPLOAD', 'No image uploaded');
        }

        let validatedImage;

        try {
            validatedImage = validateImagePayload({
                buffer: Buffer.from(parsedImage.base64, 'base64'),
                contentType: parsedImage.contentType,
            });
        } catch (error) {
            if (error instanceof ImageValidationError) {
                throw createUploadValidationError(error);
            }

            throw error;
        }

        const uploadedImage = await persistImage({
            buffer: validatedImage.buffer,
            extension: validatedImage.extension,
        });

        res.status(200).json(createUploadResponse(uploadedImage)).end();
    };
};
