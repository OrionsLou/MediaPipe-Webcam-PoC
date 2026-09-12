import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerOptions,
} from '@mediapipe/tasks-vision'

// Matches the installed @mediapipe/tasks-vision version (package.json) so the
// wasm binaries served from the CDN are guaranteed compatible with the JS API.
const WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'

// Google's hosted model asset for face landmark detection + blendshapes.
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

type Delegate = 'CPU' | 'GPU'

const DELEGATE: Delegate =
  import.meta.env.VITE_MEDIAPIPE_DELEGATE === 'CPU' ? 'CPU' : 'GPU'

let landmarkerPromise: Promise<FaceLandmarker> | null = null

/**
 * Lazily creates (and caches) a single FaceLandmarker instance for the app.
 * Safe to call multiple times — subsequent calls reuse the in-flight/created instance.
 */
export function getFaceLandmarker(
  options: Partial<FaceLandmarkerOptions> = {},
): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createFaceLandmarker(options)
  }
  return landmarkerPromise
}

async function createFaceLandmarker(
  options: Partial<FaceLandmarkerOptions>,
): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL)

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_URL,
      delegate: DELEGATE,
    },
    runningMode: 'IMAGE',
    numFaces: 1,
    ...options,
  })
}
