import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import { DELEGATE, WASM_BASE_URL } from './visionRuntime'

// Google's hosted "selfie segmenter" model — a 2-category (background,
// person) segmentation model tuned for a single foreground subject.
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

// Google's hosted "selfie multiclass" model — segments into 6 finer-grained
// categories (background, hair, body-skin, face-skin, clothes, others)
// instead of just person-vs-background.
const MULTICLASS_MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'

let imageSegmenterPromise: Promise<ImageSegmenter> | null = null
let multiclassImageSegmenterPromise: Promise<ImageSegmenter> | null = null

/**
 * Lazily creates (and caches) a single ImageSegmenter instance configured for
 * `segment` over one-off still images (e.g. a captured frame).
 */
export function getImageSegmenter(): Promise<ImageSegmenter> {
  if (!imageSegmenterPromise) {
    imageSegmenterPromise = createImageSegmenter(MODEL_ASSET_URL, {
      outputConfidenceMasks: true,
    })
  }
  return imageSegmenterPromise
}

/**
 * Lazily creates (and caches) a single ImageSegmenter instance using the
 * multiclass model, for comparing segmentation granularity against the
 * binary selfie segmenter.
 */
export function getMulticlassImageSegmenter(): Promise<ImageSegmenter> {
  if (!multiclassImageSegmenterPromise) {
    multiclassImageSegmenterPromise = createImageSegmenter(
      MULTICLASS_MODEL_ASSET_URL,
      { outputConfidenceMasks: false },
    )
  }
  return multiclassImageSegmenterPromise
}

async function createImageSegmenter(
  modelAssetPath: string,
  options: { outputConfidenceMasks: boolean },
): Promise<ImageSegmenter> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL)

  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
      delegate: DELEGATE,
    },
    runningMode: 'IMAGE',
    outputCategoryMask: true,
    ...options,
  })
}
