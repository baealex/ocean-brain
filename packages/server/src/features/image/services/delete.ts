import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

import models from '~/models.js';
import { paths } from '~/paths.js';

interface DeleteImageRecord {
    id: number;
    url: string;
}

interface ImageDeleteDeps {
    deleteImageRecord: (id: number) => Promise<void>;
    fileExists: (filePath: string) => boolean;
    findImageById: (id: number) => Promise<DeleteImageRecord | null>;
    removeFile: (filePath: string) => Promise<void>;
    resolveImagePath: (url: string) => string;
}

const PUBLIC_IMAGE_PATH_PREFIX = '/assets/images/';
const INVALID_STORED_IMAGE_PATH_MESSAGE = 'Stored image URL must point to a file inside the image directory.';

const invalidStoredImagePath = () => new Error(INVALID_STORED_IMAGE_PATH_MESSAGE);

export const resolveStoredImagePath = (url: string) => {
    if (!url.startsWith(PUBLIC_IMAGE_PATH_PREFIX)) {
        throw invalidStoredImagePath();
    }

    let relativePath: string;

    try {
        relativePath = decodeURIComponent(url.slice(PUBLIC_IMAGE_PATH_PREFIX.length));
    } catch {
        throw invalidStoredImagePath();
    }

    const pathSegments = relativePath.split('/');
    const isCanonicalRelativePath =
        relativePath.length > 0 &&
        !relativePath.includes('\\') &&
        !relativePath.includes('\0') &&
        !relativePath.includes('?') &&
        !relativePath.includes('#') &&
        pathSegments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

    if (!isCanonicalRelativePath) {
        throw invalidStoredImagePath();
    }

    const imageDir = path.resolve(paths.imageDir);
    const imagePath = path.resolve(imageDir, relativePath);
    const relativeImagePath = path.relative(imageDir, imagePath);
    const isInsideImageDir =
        relativeImagePath.length > 0 &&
        relativeImagePath !== '..' &&
        !relativeImagePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativeImagePath);

    if (!isInsideImageDir) {
        throw invalidStoredImagePath();
    }

    return imagePath;
};

export const createImageDeleteService = (deps: ImageDeleteDeps) => {
    return {
        deleteImageById: async (id: number) => {
            const image = await deps.findImageById(id);

            if (!image) {
                return false;
            }

            const imagePath = deps.resolveImagePath(image.url);

            if (deps.fileExists(imagePath)) {
                await deps.removeFile(imagePath);
            }

            await deps.deleteImageRecord(id);

            return true;
        },
    };
};

const defaultImageDeleteService = createImageDeleteService({
    deleteImageRecord: async (id) => {
        await models.image.delete({ where: { id } });
    },
    fileExists: (filePath) => fs.existsSync(filePath),
    findImageById: async (id) => {
        return models.image.findFirst({
            where: { id },
            select: {
                id: true,
                url: true,
            },
        });
    },
    removeFile: async (filePath) => {
        await fsPromises.unlink(filePath);
    },
    resolveImagePath: resolveStoredImagePath,
});

export const deleteImageById = async (id: number) => {
    return defaultImageDeleteService.deleteImageById(id);
};
