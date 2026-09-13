import type { BoundingBox } from './faceBoundingBox'

/**
 * Returns a new canvas containing just the given bounding-box region of the
 * source canvas, resized 1:1 (no scaling — the crop's pixel dimensions
 * become the output canvas's dimensions).
 */
export function cropToBoundingBox(
  source: HTMLCanvasElement,
  box: BoundingBox,
): HTMLCanvasElement {
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(box.width))
  output.height = Math.max(1, Math.round(box.height))

  const ctx = output.getContext('2d')
  if (!ctx) return output

  ctx.drawImage(
    source,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    output.width,
    output.height,
  )

  return output
}
