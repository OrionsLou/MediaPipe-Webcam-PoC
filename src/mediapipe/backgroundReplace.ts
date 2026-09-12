import type { ImageSegmenterResult } from '@mediapipe/tasks-vision'

export type SegmentationMethod = 'category' | 'confidence' | 'multiclass'

const DEFAULT_CONFIDENCE_THRESHOLD = 0.5

// Confidence-mask pixels below this are treated as background. First guess,
// configure after testing or per use case — override via
// VITE_SEGMENTATION_CONFIDENCE_THRESHOLD.
export const CONFIDENCE_THRESHOLD = (() => {
  const raw = Number(import.meta.env.VITE_SEGMENTATION_CONFIDENCE_THRESHOLD)
  return Number.isFinite(raw) && raw > 0 && raw < 1
    ? raw
    : DEFAULT_CONFIDENCE_THRESHOLD
})()

// selfie_segmenter's category mask uses index 0 for person, per observation
// against this exact model build (jsdelivr @1.0.1 /
// storage.googleapis.com selfie_segmenter float16 "latest") — everything
// else is treated as background rather than assuming a single specific
// background value, since the mask wasn't observed to be strictly binary.
const PERSON_CATEGORY_INDEX = 0

/**
 * Replaces background pixels with white using the segmenter's category mask
 * — a hard per-pixel classification the model already computed. Cheap, but
 * gives an all-or-nothing edge (no partial/antialiased transitions).
 */
export function replaceBackgroundWithCategoryMask(
  source: HTMLCanvasElement,
  result: ImageSegmenterResult,
): HTMLCanvasElement | null {
  const mask = result.categoryMask
  if (!mask) return null

  const categories = mask.getAsUint8Array()

  return replaceBackground(
    source,
    mask.width,
    mask.height,
    (maskIndex) => categories[maskIndex] !== PERSON_CATEGORY_INDEX,
  )
}

/**
 * Replaces background pixels with white using the segmenter's confidence
 * mask — a continuous per-pixel "is this the person" score — thresholded
 * against CONFIDENCE_THRESHOLD. More tunable than the category mask, at the
 * cost of picking a cutoff yourself.
 */
export function replaceBackgroundWithConfidenceMask(
  source: HTMLCanvasElement,
  result: ImageSegmenterResult,
): HTMLCanvasElement | null {
  const mask = result.confidenceMasks?.[0]
  if (!mask) return null

  const confidences = mask.getAsFloat32Array()
  return replaceBackground(
    source,
    mask.width,
    mask.height,
    (maskIndex) => confidences[maskIndex] < CONFIDENCE_THRESHOLD,
  )
}

// selfie_multiclass's category mask labels: 0=background, 1=hair,
// 2=body-skin, 3=face-skin, 4=clothes, 5=others — per Google's published
// model card. Unlike the binary selfie_segmenter (whose card turned out to
// be wrong), this hasn't been independently verified against actual output
// yet — confirm the "person" categories look right before relying on it.
const MULTICLASS_BACKGROUND_CATEGORY_INDEX = 0

/**
 * Replaces background pixels with white using the multiclass segmenter's
 * category mask. Same person-vs-background outcome as the other two
 * methods, but useful for comparing how much finer-grained attention (hair,
 * skin, clothes as distinct categories) affects edge quality.
 */
export function replaceBackgroundWithMulticlassMask(
  source: HTMLCanvasElement,
  result: ImageSegmenterResult,
): HTMLCanvasElement | null {
  const mask = result.categoryMask
  if (!mask) return null

  const categories = mask.getAsUint8Array()

  return replaceBackground(
    source,
    mask.width,
    mask.height,
    (maskIndex) =>
      categories[maskIndex] === MULTICLASS_BACKGROUND_CATEGORY_INDEX,
  )
}

function replaceBackground(
  source: HTMLCanvasElement,
  maskWidth: number,
  maskHeight: number,
  isBackground: (maskIndex: number) => boolean,
): HTMLCanvasElement {
  const output = document.createElement('canvas')
  output.width = source.width
  output.height = source.height

  const ctx = output.getContext('2d')
  if (!ctx) return output

  ctx.drawImage(source, 0, 0)
  const imageData = ctx.getImageData(0, 0, output.width, output.height)
  const { data } = imageData

  // The mask's resolution can differ from the source image (the model
  // typically runs at a smaller fixed size), so sample the nearest mask
  // pixel for each output pixel rather than assuming a 1:1 mapping.
  const scaleX = maskWidth / output.width
  const scaleY = maskHeight / output.height

  for (let y = 0; y < output.height; y++) {
    const maskY = Math.min(maskHeight - 1, Math.floor(y * scaleY))
    for (let x = 0; x < output.width; x++) {
      const maskX = Math.min(maskWidth - 1, Math.floor(x * scaleX))
      const maskIndex = maskY * maskWidth + maskX

      if (isBackground(maskIndex)) {
        const pixelIndex = (y * output.width + x) * 4
        data[pixelIndex] = 255
        data[pixelIndex + 1] = 255
        data[pixelIndex + 2] = 255
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return output
}
