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
                    bae: [
                        '@baejino/icon'
                    ],
                    core: [
                        '@blocknote/core',
                        '@blocknote/react',
                        '@blocknote/mantine'
                    ],
                    vendor: [
                        'react',
                        'react-dom'
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
