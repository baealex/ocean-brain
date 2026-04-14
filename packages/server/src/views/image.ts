import { createAppError } from '~/modules/error-handler.js';
import { persistUploadedImage } from '~/modules/image-upload.js';
import { fetchRemoteImage, RemoteImageFetchError } from '~/modules/remote-image.js';
import type { Controller } from '~/types/index.js';

export const uploadImage: Controller = async (req, res) => {
    const { image } = req.body;

    if (!image || !image.match(/data:image\/\s*(\w+);base64,/)) {
        throw createAppError(400, 'INVALID_IMAGE_UPLOAD', 'No image uploaded');
    }

    const [info, data] = image.split(',');
    const buffer = Buffer.from(data, 'base64');
    const ext = info.split(';')[0].split('/')[1];
    const uploadedImage = await persistUploadedImage({
        buffer,
        extension: ext,
    });

    res.status(200)
        .json({
            id: uploadedImage.id,
            url: uploadedImage.url,
        })
        .end();
};

export const uploadImageFromSrc: Controller = async (req, res) => {
    const { src } = req.body;

    try {
        const remoteImage = await fetchRemoteImage(String(src ?? ''));
        const uploadedImage = await persistUploadedImage({
            buffer: remoteImage.buffer,
            extension: remoteImage.extension,
        });

        res.status(200)
            .json({
                id: uploadedImage.id,
                url: uploadedImage.url,
            })
            .end();
    } catch (error) {
        if (error instanceof RemoteImageFetchError) {
            throw createAppError(error.status, error.code, error.message);
        }

        throw error;
    }
};
