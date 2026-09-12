/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDIAPIPE_DELEGATE?: 'CPU' | 'GPU'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
