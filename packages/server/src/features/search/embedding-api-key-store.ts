import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const MAX_EMBEDDING_API_KEY_LENGTH = 8_192;

export interface EmbeddingApiKeyStore {
    get(): string | undefined;
    set(apiKey?: string): void;
}

export const normalizeEmbeddingApiKey = (value: string) => {
    const apiKey = value.trim();
    if (apiKey.length > MAX_EMBEDDING_API_KEY_LENGTH) {
        throw new Error('Embedding API key is too long.');
    }
    return apiKey || undefined;
};

export const createEmbeddingApiKeyFingerprint = (apiKey?: string) => {
    if (!apiKey) {
        return '';
    }
    return createHash('sha256').update(apiKey).digest('hex');
};

export class FileEmbeddingApiKeyStore implements EmbeddingApiKeyStore {
    private apiKey: string | undefined;

    constructor(private readonly filePath: string) {
        try {
            this.apiKey = normalizeEmbeddingApiKey(readFileSync(filePath, 'utf8'));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    get() {
        return this.apiKey;
    }

    set(value?: string) {
        const apiKey = value === undefined ? undefined : normalizeEmbeddingApiKey(value);
        if (!apiKey) {
            rmSync(this.filePath, { force: true });
            this.apiKey = undefined;
            return;
        }

        mkdirSync(path.dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
        try {
            writeFileSync(temporaryPath, apiKey, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
            renameSync(temporaryPath, this.filePath);
            this.apiKey = apiKey;
        } finally {
            rmSync(temporaryPath, { force: true });
        }
    }
}
