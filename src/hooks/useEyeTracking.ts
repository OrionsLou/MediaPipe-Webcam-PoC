import { useEffect, useRef, useState, type RefObject } from 'react'
import { useFaceLandmarker } from './useFaceLandmarker'
import {
  LEFT_IRIS_CENTER_INDEX,
  RIGHT_IRIS_CENTER_INDEX,
} from '../mediapipe/eyeLandmarks'
import { getRollFromEyePositions } from '../mediapipe/headPose'

export interface EyePosition {
  x: number
  y: number
}

interface UseEyeTrackingResult {
  leftEye: EyePosition | null
  rightEye: EyePosition | null
  // Intrinsic pixel dimensions of the video frame the positions above are relative to.
  videoWidth: number
  videoHeight: number
  // Head tilt (roll), in degrees, derived from the eye positions above.
  tiltDegrees: number | null
}

/**
 * Runs FaceLandmarker over a playing <video> element frame-by-frame and
 * reports each eye's iris-center position in the video's intrinsic pixel space.
 */
export function useEyeTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
): UseEyeTrackingResult {
  const { faceLandmarker, status } = useFaceLandmarker()
  const [leftEye, setLeftEye] = useState<EyePosition | null>(null)
  const [rightEye, setRightEye] = useState<EyePosition | null>(null)
  const [videoWidth, setVideoWidth] = useState(0)
  const [videoHeight, setVideoHeight] = useState(0)
  const [tiltDegrees, setTiltDegrees] = useState<number | null>(null)

  const lastVideoTimeRef = useRef(-1)

  useEffect(() => {
    if (!active || status !== 'ready' || !faceLandmarker) {
      setLeftEye(null)
      setRightEye(null)
      setTiltDegrees(null)
      return
    }

    const video = videoRef.current
    if (!video) return

    let animationFrameId: number

    const tick = () => {
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime
          const result = faceLandmarker.detectForVideo(video, performance.now())
          const landmarks = result.faceLandmarks[0]

          if (landmarks) {
            setVideoWidth(video.videoWidth)
            setVideoHeight(video.videoHeight)

            const right = toPixelPosition(
              landmarks[RIGHT_IRIS_CENTER_INDEX],
              video,
            )
            const left = toPixelPosition(
              landmarks[LEFT_IRIS_CENTER_INDEX],
              video,
            )
            setRightEye(right)
            setLeftEye(left)
            setTiltDegrees(
              left && right ? getRollFromEyePositions(left, right) : null,
            )
          } else {
            setLeftEye(null)
            setRightEye(null)
            setTiltDegrees(null)
          }
        }
      }

      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [active, status, faceLandmarker, videoRef])

  return { leftEye, rightEye, videoWidth, videoHeight, tiltDegrees }
}

function toPixelPosition(
  landmark: { x: number; y: number } | undefined,
  video: HTMLVideoElement,
): EyePosition | null {
  if (!landmark) return null
  return {
    x: landmark.x * video.videoWidth,
    y: landmark.y * video.videoHeight,
  }
}
