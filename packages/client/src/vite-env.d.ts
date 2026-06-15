/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_DEMO_MODE?: 'local-only';
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
