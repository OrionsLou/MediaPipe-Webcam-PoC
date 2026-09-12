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

let videoLandmarkerPromise: Promise<FaceLandmarker> | null = null
let imageLandmarkerPromise: Promise<FaceLandmarker> | null = null

/**
 * Lazily creates (and caches) a single FaceLandmarker instance configured for
 * `detectForVideo` over the live webcam stream.
 */
export function getVideoFaceLandmarker(): Promise<FaceLandmarker> {
  if (!videoLandmarkerPromise) {
    videoLandmarkerPromise = createFaceLandmarker({ runningMode: 'VIDEO' })
  }
  return videoLandmarkerPromise
}

/**
 * Lazily creates (and caches) a single FaceLandmarker instance configured for
 * `detect` over one-off still images (e.g. a captured frame). Kept separate
 * from the video instance since MediaPipe's VIDEO running mode is stateful
 * and expects a single continuous timestamp sequence from one source.
 */
export function getImageFaceLandmarker(): Promise<FaceLandmarker> {
  if (!imageLandmarkerPromise) {
    imageLandmarkerPromise = createFaceLandmarker({
      runningMode: 'IMAGE',
      outputFacialTransformationMatrixes: true,
    })
  }
  return imageLandmarkerPromise
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
    numFaces: 1,
    outputFaceBlendshapes: true,
    runningMode: 'VIDEO',
    ...options,
  })
}
