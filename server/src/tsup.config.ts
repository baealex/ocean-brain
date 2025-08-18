import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/main.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    minify: false,
    splitting: false,
    treeshake: true,
    dts: false,
    external: ['@prisma/client', 'graphql-http'],
    esbuildOptions(options) {
        options.banner = { js: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url);' };
        options.alias = { '~': './src' };
    }
});
