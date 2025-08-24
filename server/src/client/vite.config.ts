import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        svgr(),
        tailwindcss()
    ],
    resolve: { alias: { '~': path.resolve(__dirname, './src') } },
    build: {
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    icon: [
                        '@baejino/icon'
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
            '/api': { target: 'http://localhost:3000' },
            '/graphql': { target: 'http://localhost:3000' },
            '/assets/images': { target: 'http://localhost:3000' }
        }
    }
});
