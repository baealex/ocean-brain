import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

import { createDevAuthGateMiddleware, isPasswordModeEnabled } from './src/dev-auth-gate';

const backendOrigin = process.env.OCEAN_BRAIN_DEV_SERVER_URL || 'http://localhost:6683';
const passwordModeEnabled = isPasswordModeEnabled(process.env);

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        svgr(),
        tailwindcss(),
        {
            name: 'ocean-brain-dev-auth-gate',
            configureServer(server) {
                server.middlewares.use(createDevAuthGateMiddleware({
                    backendOrigin,
                    enabled: passwordModeEnabled
                }));
            }
        }
    ],
    resolve: { alias: { '~': path.resolve(__dirname, './src') } },
    build: {
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    'graph-vendor': [
                        'react-force-graph-2d'
                    ],
                    'note-core': [
                        '@blocknote/core'
                    ],
                    'note-vendor': [
                        '@blocknote/react',
                        '@blocknote/mantine'
                    ]
                }
            }
        }
    },
    server: {
        host: '0.0.0.0',
        proxy: {
            '/api': { target: 'http://localhost:6683' },
            '/auth': { target: 'http://localhost:6683' },
            '/graphql': { target: 'http://localhost:6683' },
            '/assets/images': { target: 'http://localhost:6683' }
        }
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
            exclude: [
                'src/**/*.d.ts',
                'src/**/*.spec.ts',
                'src/**/*.spec.tsx',
                'src/test/**'
            ]
        }
    }
});
