import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/mcp.ts'],
    format: ['esm'],
    target: 'es2022',
    platform: 'node',
    outDir: 'dist',
    clean: true,
    metafile: true,
    bundle: true,
    splitting: true,
    treeshake: true,
    minify: false,
    shims: true,
    removeNodeProtocol: false,
    skipNodeModulesBundle: false,
    banner: {
        js: [
            '#!/usr/bin/env node',
            "import { createRequire as __createRequire } from 'node:module';",
            'const require = __createRequire(import.meta.url);',
        ].join('\n'),
    },
    esbuildOptions(options) {
        options.legalComments = 'eof';
    }
});
