import type {
  FaceLandmarkerResult,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { LEFT_EYE_EAR_INDICES, RIGHT_EYE_EAR_INDICES } from './eyeLandmarks'

export type EyeState = 'open' | 'closed'
export type EyeDetectionMethod = 'blendshapes' | 'ear'

export interface EyeStateResult {
  left: EyeState
  right: EyeState
}

// Blendshape score above this is considered a closed/blinking eye.
// First guess, configure after testing or per use case.
const BLINK_SCORE_THRESHOLD = 0.5

// EAR below this is considered closed. EAR is a ratio (vertical eyelid gap
// over horizontal eye width), so it's roughly scale-invariant across face
// sizes/distances — but the exact cutoff is still an approximation tuned
// against the classic dlib/PyImageSearch EAR threshold, not derived from
// this model. Adjust if it misfires for your camera/lighting.
const EAR_CLOSED_THRESHOLD = 0.2

/**
 * Reads eye-open/closed state from the model's `eyeBlinkLeft`/`eyeBlinkRight`
 * blendshape scores. Requires the landmarker to have been created with
 * `outputFaceBlendshapes: true`.
 */
export function getEyeStateFromBlendshapes(
  result: FaceLandmarkerResult,
): EyeStateResult | null {
  const categories = result.faceBlendshapes?.[0]?.categories
  if (!categories) return null

  const leftScore = categories.find(
    (c) => c.categoryName === 'eyeBlinkLeft',
  )?.score
  const rightScore = categories.find(
    (c) => c.categoryName === 'eyeBlinkRight',
  )?.score
  if (leftScore === undefined || rightScore === undefined) return null

  return {
    left: leftScore > BLINK_SCORE_THRESHOLD ? 'closed' : 'open',
    right: rightScore > BLINK_SCORE_THRESHOLD ? 'closed' : 'open',
  }
}

/**
 * Computes eye-open/closed state geometrically from face mesh landmarks,
 * using the eye aspect ratio (EAR): the ratio of vertical eyelid distance to
 * horizontal eye width. A near-closed eye has a small vertical gap, so EAR
 * drops sharply on a blink/closure.
 */
export function getEyeStateFromEAR(
  result: FaceLandmarkerResult,
): EyeStateResult | null {
  const landmarks = result.faceLandmarks?.[0]
  if (!landmarks) return null

  const leftEAR = computeEAR(landmarks, LEFT_EYE_EAR_INDICES)
  const rightEAR = computeEAR(landmarks, RIGHT_EYE_EAR_INDICES)

  return {
    left: leftEAR < EAR_CLOSED_THRESHOLD ? 'closed' : 'open',
    right: rightEAR < EAR_CLOSED_THRESHOLD ? 'closed' : 'open',
  }
}

function computeEAR(
  landmarks: NormalizedLandmark[],
  [corner1, upper1, upper2, corner2, lower2, lower1]: readonly number[],
): number {
  const verticalA = distance(landmarks[upper1], landmarks[lower1])
  const verticalB = distance(landmarks[upper2], landmarks[lower2])
  const horizontal = distance(landmarks[corner1], landmarks[corner2])
  return (verticalA + verticalB) / (2 * horizontal)
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
