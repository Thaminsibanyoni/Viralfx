/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_URL: string;
  readonly VITE_PWA_ENABLED: string;
  readonly VITE_DEFAULT_THEME: string;
  readonly VITE_BUILD_TARGET: string;
  readonly VITE_CHUNK_SIZE_WARNING: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_ENABLE_MOCKING: string;
  readonly VITE_WS_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_NODE_ENV: string;
  readonly VITE_DEVTOOLS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}