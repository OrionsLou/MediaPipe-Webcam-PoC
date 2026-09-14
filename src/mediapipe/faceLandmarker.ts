import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerOptions,
} from '@mediapipe/tasks-vision'
import { DELEGATE, WASM_BASE_URL } from './visionRuntime'
import { getOrFetchModelBuffer } from '../cache/modelCache'

// Google's hosted model asset for face landmark detection + blendshapes.
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

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
  const [vision, modelAssetBuffer] = await Promise.all([
    FilesetResolver.forVisionTasks(WASM_BASE_URL),
    getOrFetchModelBuffer(MODEL_ASSET_URL),
  ])

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetBuffer,
      delegate: DELEGATE,
    },
    numFaces: 1,
    outputFaceBlendshapes: true,
    runningMode: 'VIDEO',
    ...options,
  })
}
