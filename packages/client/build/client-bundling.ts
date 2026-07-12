import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';

type RollupOptions = NonNullable<NonNullable<UserConfig['build']>['rollupOptions']>;

/**
 * Client bundle safety contract:
 *
 * 1. Keep route-preload as an independent entry. A normal module script in
 *    index.html is merged into the app entry and cannot start route downloads
 *    early enough for cold note URLs.
 * 2. Manually group only dependencies owned exclusively by the Note route.
 *    Object-form manualChunks pulls React and other transitive dependencies into
 *    note chunks, which makes the home entry load them again.
 * 3. Keep note-runtime together. Splitting its editor/markup/support packages
 *    produced circular chunks and production-only initialization risk.
 * 4. Do not silence the remaining note-runtime size warning. It is route-only;
 *    scripts/ci/check-client-bundle.mjs enforces the actual initial-load budget.
 *
 * Production behavior is guarded by the bundle check and
 * tests/e2e/production-routes.spec.ts. Update those guards with this file.
 */

const NOTE_PAGE_MODULE_SUFFIX = '/src/pages/Note.tsx';
const ROUTE_LOADER_MODULE_SUFFIXES = ['/src/route-preload.ts', '/src/router.tsx'];

const normalizeModuleId = (id: string) => id.replaceAll('\\', '/').split('?')[0] ?? id;
const isRouteLoaderModule = (id: string) => {
    const normalizedId = normalizeModuleId(id);
    return ROUTE_LOADER_MODULE_SUFFIXES.some((suffix) => normalizedId.endsWith(suffix));
};

const getNoteChunkName = (id: string) => {
    const normalizedId = normalizeModuleId(id);

    if (normalizedId.includes('/node_modules/@blocknote/core/')) {
        return 'note-core';
    }

    if (
        normalizedId.includes('/node_modules/@blocknote/react/') ||
        normalizedId.includes('/node_modules/@blocknote/mantine/')
    ) {
        return 'note-ui';
    }

    return 'note-runtime';
};

const createNoteOnlyManualChunks = () => {
    return (
        id: string,
        {
            getModuleInfo,
        }: {
            getModuleInfo: (id: string) => {
                dynamicImporters: readonly string[];
                importers: readonly string[];
                isEntry: boolean;
            } | null;
        },
    ) => {
        if (!id.includes('/node_modules/')) {
            return;
        }

        const owners = new Set<string>();
        const pending = [id];
        const visited = new Set<string>();

        while (pending.length > 0) {
            const currentId = pending.pop();

            if (!currentId || visited.has(currentId)) {
                continue;
            }

            visited.add(currentId);
            const moduleInfo = getModuleInfo(currentId);

            if (!moduleInfo) {
                continue;
            }

            if (moduleInfo.isEntry || moduleInfo.dynamicImporters.some(isRouteLoaderModule)) {
                owners.add(normalizeModuleId(currentId));
                continue;
            }

            pending.push(...moduleInfo.importers);
        }

        const [owner] = owners;
        return owners.size === 1 && owner?.endsWith(NOTE_PAGE_MODULE_SUFFIX) ? getNoteChunkName(id) : undefined;
    };
};

export const createRoutePreloadPlugin = (): Plugin => {
    let command: 'build' | 'serve' = 'serve';

    return {
        name: 'ocean-brain-route-preload',
        configResolved(config) {
            command = config.command;
        },
        transformIndexHtml: {
            // Post injection is intentional: Vite must not merge this script into the app entry.
            order: 'post',
            handler() {
                return [
                    {
                        tag: 'script',
                        attrs: {
                            type: 'module',
                            src: command === 'build' ? '/assets/route-preload.js' : '/src/route-preload.ts',
                        },
                        injectTo: 'head-prepend',
                    },
                ];
            },
        },
    };
};

export const createClientRollupOptions = (clientRoot: string): RollupOptions => ({
    input: {
        app: path.resolve(clientRoot, 'index.html'),
        'route-preload': path.resolve(clientRoot, 'src/route-preload.ts'),
    },
    output: {
        entryFileNames(chunkInfo) {
            return chunkInfo.name === 'route-preload' ? 'assets/route-preload.js' : 'assets/[name]-[hash].js';
        },
        manualChunks: createNoteOnlyManualChunks(),
        onlyExplicitManualChunks: true,
    },
});
