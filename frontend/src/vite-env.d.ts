/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FORUM_API_URL?: string;
  readonly VITE_AUTH_SERVICE_URL?: string;
  readonly VITE_GIT_SERVICE_URL?: string;
  readonly VITE_GIT_SERVICE_REPO?: string;
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
