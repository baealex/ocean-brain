import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        svgr()
    ],
    css: { preprocessorOptions: { scss: { api: 'modern' } } },
    resolve: { alias: { '~': path.resolve(__dirname, './src') } },
    server: {
        host: '0.0.0.0',
        proxy: {
            '/api': { target: 'http://localhost:3000' },
            '/graphql': { target: 'http://localhost:3000' },
            '/assets/images': { target: 'http://localhost:3000' }
        }
    }
});
