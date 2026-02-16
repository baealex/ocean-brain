import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'es2022',
    outDir: 'dist',
    clean: true,
    banner: {
        js: '#!/usr/bin/env node'
    },
    external: [
        /^[^./]|^\.[^./]|^\.\.[^/]/
    ]
});
