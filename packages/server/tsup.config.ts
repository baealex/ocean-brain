import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'tsup';

const LOGIN_PAGE_TEMPLATE = readFileSync('src/features/auth/http/login-page.html', 'utf8');
const configRequire = createRequire(import.meta.url);
const jsdomEntry = configRequire.resolve('jsdom');
// jsdom resolves this worker by filename at runtime, so it must remain a named output entry.
const xhrSyncWorkerEntry = path.resolve(path.dirname(jsdomEntry), 'jsdom/living/xhr/xhr-sync-worker.js');
const SERVER_PACKAGE = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies?: Record<string, string>;
    oceanBrain?: { bundleExternals?: string[] };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Native packages and identity-sensitive runtimes such as GraphQL stay installed as singletons.
const bundleExternals = SERVER_PACKAGE.oceanBrain?.bundleExternals ?? [];
const bundledDependencies = Object.keys(SERVER_PACKAGE.dependencies ?? {}).filter(
    (dependency) => !bundleExternals.includes(dependency),
);

export default defineConfig({
    entry: {
        start: 'src/start.ts',
        'xhr-sync-worker': xhrSyncWorkerEntry,
    },
    format: ['esm'],
    target: 'es2022',
    platform: 'node',
    outDir: 'dist',
    clean: true,
    sourcemap: false,
    splitting: true,
    treeshake: true,
    minify: false,
    bundle: true,
    shims: true,
    removeNodeProtocol: false,
    skipNodeModulesBundle: false,
    noExternal: bundledDependencies.map((dependency) => new RegExp(`^${escapeRegExp(dependency)}(?:/|$)`)),
    define: {
        __LOGIN_PAGE_TEMPLATE__: JSON.stringify(LOGIN_PAGE_TEMPLATE),
    },
    external: bundleExternals.map((dependency) => new RegExp(`^${escapeRegExp(dependency)}(?:/|$)`)),
    banner: {
        js: [
            "import { createRequire as __createRequire } from 'node:module';",
            'const require = __createRequire(import.meta.url);',
        ].join('\n'),
    },
    esbuildOptions(options) {
        options.legalComments = 'eof';
    },
});
