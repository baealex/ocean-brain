import { defineConfig } from 'tsup';

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
    external: [/^[^./]|^\.[^./]|^\.\.[^/]/],
});
