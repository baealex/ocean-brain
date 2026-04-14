import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import models from '~/models.js';
import { paths } from '~/paths.js';

interface ImageRecord {
    id: number;
    url: string;
}

interface ImageUploadDeps {
    createImage: (input: { hash: string; url: string }) => Promise<ImageRecord>;
    ensureDir: (dirPath: string) => Promise<void>;
    findImageByHash: (hash: string) => Promise<ImageRecord | null>;
    removeFile: (filePath: string) => Promise<void>;
    writeFile: (filePath: string, buffer: Buffer) => Promise<void>;
}

export interface PersistImageInput {
    buffer: Buffer;
    extension: string;
}

export interface PersistedImageSummary {
    id: number;
    url: string;
}

export const hashImageBuffer = (buffer: Buffer) => {
    return crypto.createHash('sha512').update(buffer).digest('hex');
};

const buildImageTarget = (hash: string, extension: string, now = new Date()) => {
    const normalizedExtension = extension.trim().toLowerCase().replace(/^\./, '');
    const currentPath = [now.getFullYear().toString(), (now.getMonth() + 1).toString(), now.getDate().toString()];
    const targetDir = path.resolve(paths.imageDir, ...currentPath);
    const fileName = `${hash}.${normalizedExtension}`;

    return {
        targetDir,
        absolutePath: path.resolve(targetDir, fileName),
        url: `/assets/images/${currentPath.join('/')}/${fileName}`,
    };
};

const isImageHashUniqueConflict = (error: unknown) => {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return false;
    }

    if (error.code !== 'P2002') {
        return false;
    }

    if (!('meta' in error) || typeof error.meta !== 'object' || error.meta === null) {
        return true;
    }

    const rawTarget = 'target' in error.meta ? error.meta.target : undefined;
    const targets = Array.isArray(rawTarget)
        ? rawTarget.filter((value): value is string => typeof value === 'string')
        : typeof rawTarget === 'string'
          ? [rawTarget]
          : [];

    return targets.length === 0 || targets.includes('hash');
};

const removeFileIfPresent = async (deps: Pick<ImageUploadDeps, 'removeFile'>, filePath: string) => {
    try {
        await deps.removeFile(filePath);
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return;
        }

        throw error;
    }
};

export const createImageUploadService = (deps: ImageUploadDeps) => {
    return {
        persistImage: async (input: PersistImageInput): Promise<PersistedImageSummary> => {
            const hash = hashImageBuffer(input.buffer);
            const existingImage = await deps.findImageByHash(hash);

            if (existingImage) {
                return existingImage;
            }

            const target = buildImageTarget(hash, input.extension);

            await deps.ensureDir(target.targetDir);
            await deps.writeFile(target.absolutePath, input.buffer);

            try {
                return await deps.createImage({
                    hash,
                    url: target.url,
                });
            } catch (error) {
                await removeFileIfPresent(deps, target.absolutePath);

                if (isImageHashUniqueConflict(error)) {
                    const conflictedImage = await deps.findImageByHash(hash);

                    if (conflictedImage) {
                        return conflictedImage;
                    }
                }

                throw error;
            }
        },
    };
};

const defaultImageUploadService = createImageUploadService({
    createImage: async (input) => {
        return models.image.create({
            data: input,
            select: {
                id: true,
                url: true,
            },
        });
    },
    ensureDir: async (dirPath) => {
        await fs.mkdir(dirPath, { recursive: true });
    },
    findImageByHash: async (hash) => {
        return models.image.findFirst({
            where: { hash },
            select: {
                id: true,
                url: true,
            },
        });
    },
    removeFile: async (filePath) => {
        await fs.unlink(filePath);
    },
    writeFile: async (filePath, buffer) => {
        await fs.writeFile(filePath, buffer);
    },
});

export const persistUploadedImage = async (input: PersistImageInput) => {
    return defaultImageUploadService.persistImage(input);
};
