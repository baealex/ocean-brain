import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import { fetchRemoteImage, type RemoteImage, RemoteImageFetchError } from '../services/remote-fetch.js';
import { type PersistedImageSummary, type PersistImageInput, persistUploadedImage } from '../services/upload.js';

type PersistImage = (input: PersistImageInput) => Promise<PersistedImageSummary>;
type FetchImage = (src: string) => Promise<RemoteImage>;

const createUploadResponse = (image: PersistedImageSummary) => {
    return {
        id: image.id,
        url: image.url,
    };
};

export const createUploadImageHandler = (persistImage: PersistImage = persistUploadedImage): Controller => {
    return async (req, res) => {
        const { image } = req.body ?? {};

        if (typeof image !== 'string' || !image.match(/data:image\/\s*(\w+);base64,/)) {
            throw createAppError(400, 'INVALID_IMAGE_UPLOAD', 'No image uploaded');
        }

        const [info, data] = image.split(',');
        const buffer = Buffer.from(data, 'base64');
        const extension = info.split(';')[0]?.split('/')[1] ?? '';
        const uploadedImage = await persistImage({
            buffer,
            extension,
        });

        res.status(200).json(createUploadResponse(uploadedImage)).end();
    };
};

export const createUploadImageFromSrcHandler = (
    fetchImage: FetchImage = fetchRemoteImage,
    persistImage: PersistImage = persistUploadedImage,
): Controller => {
    return async (req, res) => {
        const src = String(req.body?.src ?? '');

        try {
            const remoteImage = await fetchImage(src);
            const uploadedImage = await persistImage({
                buffer: remoteImage.buffer,
                extension: remoteImage.extension,
            });

            res.status(200).json(createUploadResponse(uploadedImage)).end();
        } catch (error) {
            if (error instanceof RemoteImageFetchError) {
                throw createAppError(error.status, error.code, error.message);
            }

            throw error;
        }
    };
};
