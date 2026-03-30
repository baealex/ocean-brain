import fs from 'fs';
import path from 'path';

import models from '~/models.js';
import { paths } from '~/paths.js';

export interface ImageDeletePreview {
    id: string;
    url: string;
    referenceCount: number;
}

export interface ImageDeleteService {
    deleteImageById: (id: number) => Promise<ImageDeletePreview | null>;
    getDeletePreview: (id: number) => Promise<ImageDeletePreview | null>;
}

export const createImageDeleteService = (deps: {
    countReferences: (url: string) => Promise<number>;
    deleteImageRecord: (id: number) => Promise<void>;
    fileExists: (filePath: string) => boolean;
    findImage: (id: number) => Promise<{ id: number; url: string } | null>;
    imageDir: string;
    unlinkFile: (filePath: string) => void;
}): ImageDeleteService => {
    const buildPreview = async (id: number) => {
        const image = await deps.findImage(id);

        if (!image) {
            return null;
        }

        const referenceCount = await deps.countReferences(image.url);

        return {
            id: String(image.id),
            url: image.url,
            referenceCount
        };
    };

    return {
        getDeletePreview: (id: number) => buildPreview(id),
        deleteImageById: async (id: number) => {
            const preview = await buildPreview(id);

            if (!preview) {
                return null;
            }

            const imagePath = path.resolve(deps.imageDir, preview.url.replace('/assets/images/', ''));

            if (deps.fileExists(imagePath)) {
                deps.unlinkFile(imagePath);
            }

            await deps.deleteImageRecord(Number(preview.id));
            return preview;
        }
    };
};

const imageDeleteService = createImageDeleteService({
    countReferences: (url: string) => models.note.count({ where: { content: { contains: url } } }),
    deleteImageRecord: (id: number) => models.image.delete({ where: { id } }).then(() => undefined),
    fileExists: (filePath: string) => fs.existsSync(filePath),
    findImage: (id: number) => models.image.findFirst({ where: { id } }),
    imageDir: paths.imageDir,
    unlinkFile: (filePath: string) => fs.unlinkSync(filePath)
});

export const getImageDeletePreview = imageDeleteService.getDeletePreview;
export const deleteImageById = imageDeleteService.deleteImageById;
