/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_II_URL?: string;
    // Add other VITE_ prefixed environment variables here as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
