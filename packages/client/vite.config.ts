import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';

import { createClientRollupOptions, createRoutePreloadPlugin } from './build/client-bundling';
import { createDevAuthGateMiddleware } from './src/dev-auth-gate';

const backendOrigin = process.env.OCEAN_BRAIN_DEV_SERVER_URL || 'http://localhost:6683';
const isLocalOnlyDemoBuild = process.env.VITE_DEMO_MODE === 'local-only';
const demoSidebarPromoSlotPath = isLocalOnlyDemoBuild
    ? './src/components/demo/DemoSidebarPromoSlot.tsx'
    : './src/components/demo/DemoSidebarPromoSlot.noop.tsx';
const mcpAdminAdapterPath = isLocalOnlyDemoBuild
    ? './src/apis/mcp-admin-adapter.local.ts'
    : './src/apis/mcp-admin-adapter.ts';
const imageUploadAdapterPath = isLocalOnlyDemoBuild
    ? './src/apis/image-upload-adapter.local.ts'
    : './src/apis/image-upload-adapter.ts';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        createRoutePreloadPlugin(),
        react(),
        svgr(),
        tailwindcss(),
        {
            name: 'ocean-brain-dev-auth-gate',
            configureServer(server) {
                server.middlewares.use(createDevAuthGateMiddleware({ backendOrigin }));
            },
        },
    ],
    resolve: {
        alias: [
            {
                find: '~/components/demo/DemoSidebarPromoSlot',
                replacement: path.resolve(__dirname, demoSidebarPromoSlotPath),
            },
            {
                find: '~/apis/mcp-admin-adapter',
                replacement: path.resolve(__dirname, mcpAdminAdapterPath),
            },
            {
                find: '~/apis/image-upload-adapter',
                replacement: path.resolve(__dirname, imageUploadAdapterPath),
            },
            { find: '~', replacement: path.resolve(__dirname, './src') },
        ],
    },
    build: {
        sourcemap: false,
        rollupOptions: createClientRollupOptions(__dirname),
    },
    server: {
        host: '0.0.0.0',
        proxy: {
            '/api': { target: backendOrigin },
            '/login': { target: backendOrigin },
            '/logout': { target: backendOrigin },
            '/graphql': { target: backendOrigin },
            '/assets/images': { target: backendOrigin },
        },
    },
    test: {
        globals: true,
        pool: 'threads',
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        css: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/test/**'],
        },
    },
});
