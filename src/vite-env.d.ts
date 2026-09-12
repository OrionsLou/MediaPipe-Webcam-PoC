/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDIAPIPE_DELEGATE?: 'CPU' | 'GPU'
  readonly VITE_TILT_THRESHOLD_DEGREES?: string
  readonly VITE_SEGMENTATION_CONFIDENCE_THRESHOLD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
