import { defineConfig } from 'tsup';
import { glob } from 'glob';

export default defineConfig({
    entry: glob.sync('src/**/*.ts'),
    format: ['esm'],
    target: 'es2022',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: false,
    minify: false,
    bundle: false,
    external: [
        /^[^./]|^\.[^./]|^\.\.[^/]/
    ]
});
