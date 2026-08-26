// @vitest-environment node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
    if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
        return;
    }

    process.env.NODE_ENV = originalNodeEnv;
});

describe('client build environment', () => {
    it('resolves a production build when NODE_ENV is inherited as development', async () => {
        process.env.NODE_ENV = 'development';

        const config = await resolveConfig(
            {
                configFile: path.resolve(clientRoot, 'vite.config.ts'),
                logLevel: 'silent',
                root: clientRoot,
            },
            'build',
            'production',
            'production',
        );

        expect(config.isProduction).toBe(true);
        expect(process.env.NODE_ENV).toBe('production');
    });
});
