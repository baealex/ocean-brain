import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const LOGIN_PAGE_TEMPLATE = readFileSync('src/features/auth/http/login-page.html', 'utf8');

export default defineConfig({
    entry: ['src/**/*.ts', '!src/**/*.test.ts'],
    format: ['esm'],
    target: 'es2022',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: false,
    minify: false,
    bundle: false,
    define: {
        __LOGIN_PAGE_TEMPLATE__: JSON.stringify(LOGIN_PAGE_TEMPLATE),
    },
    external: [/^[^./]|^\.[^./]|^\.\.[^/]/],
});
