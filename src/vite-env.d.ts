/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDIAPIPE_DELEGATE?: 'CPU' | 'GPU'
  readonly VITE_TILT_THRESHOLD_DEGREES?: string
  readonly VITE_SEGMENTATION_CONFIDENCE_THRESHOLD?: string
  readonly VITE_FACE_BOX_MARGIN_RATIO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
