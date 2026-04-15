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

export const resolveStoredImagePath = (url: string) => {
    return path.resolve(paths.imageDir, url.replace('/assets/images/', ''));
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
