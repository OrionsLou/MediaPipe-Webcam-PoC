import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_MARGIN_RATIO = 0.25

// Margin added around the tight face-mesh box, as a fraction of its
// width/height. First guess, configure after testing or per use case —
// override via VITE_FACE_BOX_MARGIN_RATIO.
export const FACE_BOX_MARGIN_RATIO = (() => {
  const raw = Number(import.meta.env.VITE_FACE_BOX_MARGIN_RATIO)
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_MARGIN_RATIO
})()

// The face mesh only covers facial skin (roughly chin to hairline), not the
// top of the skull or hair volume above it. Passport-photo-style crops need
// headroom for hair, so the top margin gets extra weight relative to the
// sides/bottom rather than expanding the box evenly in every direction.
const TOP_MARGIN_MULTIPLIER = 2

// Whether the desired (unclamped) passport-photo box around a face would
// have extended past the frame on a given edge — i.e. that part of the head
// is missing from the captured frame, not just tightly cropped.
export interface HeadClipping {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
}

export const NO_HEAD_CLIPPING: HeadClipping = {
  top: false,
  bottom: false,
  left: false,
  right: false,
}

export function isHeadClipped(clipping: HeadClipping): boolean {
  return clipping.top || clipping.bottom || clipping.left || clipping.right
}

interface FaceBoundingBoxResult {
  box: BoundingBox
  // Whether the box was clamped to the frame on each edge, meaning the head
  // (or hair) likely extends beyond what the camera captured there.
  clipping: HeadClipping
}

function computeFaceBoundingBox(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): FaceBoundingBoxResult | null {
  if (landmarks.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const { x, y } of landmarks) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const marginX = (maxX - minX) * FACE_BOX_MARGIN_RATIO
  const marginY = (maxY - minY) * FACE_BOX_MARGIN_RATIO

  const desiredMinX = minX - marginX
  const desiredMaxX = maxX + marginX
  const desiredMinY = minY - marginY * TOP_MARGIN_MULTIPLIER
  const desiredMaxY = maxY + marginY

  // Clamp to the frame's normalized [0, 1] bounds — the margin can otherwise
  // push the box off-frame for a face near an edge.
  const expandedMinX = Math.max(0, desiredMinX)
  const expandedMaxX = Math.min(1, desiredMaxX)
  const expandedMinY = Math.max(0, desiredMinY)
  const expandedMaxY = Math.min(1, desiredMaxY)

  return {
    box: {
      x: expandedMinX * videoWidth,
      y: expandedMinY * videoHeight,
      width: (expandedMaxX - expandedMinX) * videoWidth,
      height: (expandedMaxY - expandedMinY) * videoHeight,
    },
    clipping: {
      top: desiredMinY < 0,
      bottom: desiredMaxY > 1,
      left: desiredMinX < 0,
      right: desiredMaxX > 1,
    },
  }
}

/**
 * Bounding box (in pixel space) around a face, expanded by
 * FACE_BOX_MARGIN_RATIO beyond the landmarks' tight contour to approximate a
 * passport-photo-style crop that includes the whole head and hair — not
 * just the facial skin the mesh actually covers.
 */
export function getFaceBoundingBox(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): BoundingBox | null {
  return computeFaceBoundingBox(landmarks, videoWidth, videoHeight)?.box ?? null
}

/**
 * Like getFaceBoundingBox, but also reports which edges of the desired crop
 * were clamped to the frame — i.e. where part of the head is likely missing
 * from the captured image (e.g. the top of the head cut off).
 */
export function getHeadClipping(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): HeadClipping | null {
  const result = computeFaceBoundingBox(landmarks, videoWidth, videoHeight)
  return result?.clipping ?? null
}
