import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import { DELEGATE, WASM_BASE_URL } from './visionRuntime'

// Google's hosted "selfie segmenter" model — a 2-category (background,
// person) segmentation model tuned for a single foreground subject.
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

let imageSegmenterPromise: Promise<ImageSegmenter> | null = null

/**
 * Lazily creates (and caches) a single ImageSegmenter instance configured for
 * `segment` over one-off still images (e.g. a captured frame).
 */
export function getImageSegmenter(): Promise<ImageSegmenter> {
  if (!imageSegmenterPromise) {
    imageSegmenterPromise = createImageSegmenter()
  }
  return imageSegmenterPromise
}

async function createImageSegmenter(): Promise<ImageSegmenter> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL)

  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_URL,
      delegate: DELEGATE,
    },
    runningMode: 'IMAGE',
    outputCategoryMask: true,
    outputConfidenceMasks: true,
  })
}
