import type { Matrix } from '@mediapipe/tasks-vision'

const RAD_TO_DEG = 180 / Math.PI

export interface HeadPose {
  /** Rotation around the horizontal axis (nodding up/down), in degrees. */
  pitch: number
  /** Rotation around the vertical axis (turning left/right), in degrees. */
  yaw: number
  /** Rotation around the depth axis (tilting ear-to-shoulder), in degrees. */
  roll: number
}

/**
 * Roll angle (head tilt) from two 2D eye positions — the angle of the line
 * between them relative to horizontal. Cheap, and reuses points we already
 * track per frame, but only captures roll: it can't tell nodding from
 * turning since it has no depth information.
 *
 * Positions are expected in the same (unmirrored) pixel space the video
 * element reports — since the video is displayed mirrored via CSS, the sign
 * here reflects raw camera space, not what appears on screen. Flip the sign
 * if that reads backwards for your use case.
 */
export function getRollFromEyePositions(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.atan2(right.y - left.y, right.x - left.x) * RAD_TO_DEG
}

/**
 * Decomposes FaceLandmarker's facial transformation matrix into pitch/yaw/roll
 * euler angles, for full 3D head pose on a single captured image.
 *
 * The matrix is a 4x4 homogeneous transform (rotation + translation) from
 * MediaPipe's canonical face model space to the detected face, flattened
 * column-major (matching the WebGL convention MediaPipe's own face-effect
 * samples feed it into). This decomposition assumes rotation order
 * R = Rz(roll) * Rx(pitch) * Ry(yaw) — a common convention for head pose, but
 * not verified against this exact model's output. Treat signs/axes as
 * approximate until checked against real tilts/nods/turns.
 */
export function getHeadPoseFromMatrix(matrix: Matrix): HeadPose | null {
  if (matrix.rows !== 4 || matrix.columns !== 4) return null

  // Column-major 4x4: element (row, col) lives at data[col * 4 + row].
  const at = (row: number, col: number) => matrix.data[col * 4 + row]

  const r00 = at(0, 0)
  const r10 = at(1, 0)
  const r20 = at(2, 0)
  const r21 = at(2, 1)
  const r22 = at(2, 2)

  const pitch = Math.atan2(-r21, r22) * RAD_TO_DEG
  const yaw = Math.atan2(r20, Math.hypot(r21, r22)) * RAD_TO_DEG
  const roll = Math.atan2(-r10, r00) * RAD_TO_DEG

  return { pitch, yaw, roll }
}

const DEFAULT_TILT_THRESHOLD_DEGREES = 15

// A head is considered tilted if any axis exceeds this many degrees from
// neutral. First guess, configure after testing or per use case — override
// via VITE_TILT_THRESHOLD_DEGREES.
export const TILT_THRESHOLD_DEGREES = (() => {
  const raw = Number(import.meta.env.VITE_TILT_THRESHOLD_DEGREES)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TILT_THRESHOLD_DEGREES
})()

/**
 * Whether a head pose counts as "tilted", based on whether pitch, yaw, or
 * roll exceeds TILT_THRESHOLD_DEGREES in either direction.
 */
export function isHeadTilted(pose: HeadPose): boolean {
  return (
    Math.abs(pose.pitch) > TILT_THRESHOLD_DEGREES ||
    Math.abs(pose.yaw) > TILT_THRESHOLD_DEGREES ||
    Math.abs(pose.roll) > TILT_THRESHOLD_DEGREES
  )
}
