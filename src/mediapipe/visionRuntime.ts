// Matches the installed @mediapipe/tasks-vision version (package.json) so the
// wasm binaries served from the CDN are guaranteed compatible with the JS API.
// Shared by every MediaPipe vision task (FaceLandmarker, ImageSegmenter, ...).
export const WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'

export type Delegate = 'CPU' | 'GPU'

export const DELEGATE: Delegate =
  import.meta.env.VITE_MEDIAPIPE_DELEGATE === 'CPU' ? 'CPU' : 'GPU'
