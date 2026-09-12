import { useEffect, useRef, useState, type RefObject } from 'react'
import { useFaceLandmarker } from './useFaceLandmarker'
import {
  LEFT_IRIS_CENTER_INDEX,
  RIGHT_IRIS_CENTER_INDEX,
} from '../mediapipe/eyeLandmarks'

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

  const lastVideoTimeRef = useRef(-1)

  useEffect(() => {
    if (!active || status !== 'ready' || !faceLandmarker) {
      setLeftEye(null)
      setRightEye(null)
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
            setRightEye(toPixelPosition(landmarks[RIGHT_IRIS_CENTER_INDEX], video))
            setLeftEye(toPixelPosition(landmarks[LEFT_IRIS_CENTER_INDEX], video))
          } else {
            setLeftEye(null)
            setRightEye(null)
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

  return { leftEye, rightEye, videoWidth, videoHeight }
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
