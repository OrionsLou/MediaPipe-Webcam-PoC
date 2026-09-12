import { useEffect, useMemo, useRef, useState } from 'react'
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { useEyeTracking } from '../hooks/useEyeTracking'
import { getImageFaceLandmarker } from '../mediapipe/faceLandmarker'
import {
  getEyeStateFromBlendshapes,
  getEyeStateFromEAR,
  type EyeDetectionMethod,
} from '../mediapipe/eyeState'
import { getHeadPoseFromMatrix } from '../mediapipe/headPose'
import './WebcamView.css'

interface WebcamViewProps {
  onCapture?: (imageData: ImageData, canvas: HTMLCanvasElement) => void
}

type CameraStatus = 'idle' | 'starting' | 'streaming' | 'error'

function WebcamView({ onCapture }: WebcamViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [captureUrl, setCaptureUrl] = useState<string | null>(null)

  const [captureResult, setCaptureResult] =
    useState<FaceLandmarkerResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [method, setMethod] = useState<EyeDetectionMethod>('blendshapes')

  const { leftEye, rightEye, videoWidth, videoHeight, tiltDegrees } =
    useEyeTracking(videoRef, status === 'streaming')

  const eyeState = useMemo(() => {
    if (!captureResult) return null
    return method === 'blendshapes'
      ? getEyeStateFromBlendshapes(captureResult)
      : getEyeStateFromEAR(captureResult)
  }, [captureResult, method])

  const headPose = useMemo(() => {
    const matrix = captureResult?.facialTransformationMatrixes?.[0]
    return matrix ? getHeadPoseFromMatrix(matrix) : null
  }, [captureResult])

  useEffect(() => {
    return () => {
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draws eye markers on an overlay canvas positioned on top of the video.
  // The video uses object-fit: cover, so eye positions (in the video's
  // intrinsic pixel space) must be mapped through the same crop/scale math.
  useEffect(() => {
    const canvas = overlayCanvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const containerWidth = video.clientWidth
    const containerHeight = video.clientHeight
    canvas.width = containerWidth
    canvas.height = containerHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, containerWidth, containerHeight)

    if (!videoWidth || !videoHeight) return

    const scale = Math.max(
      containerWidth / videoWidth,
      containerHeight / videoHeight,
    )
    const offsetX = (containerWidth - videoWidth * scale) / 2
    const offsetY = (containerHeight - videoHeight * scale) / 2

    const drawEye = (eye: { x: number; y: number } | null) => {
      if (!eye) return
      const x = eye.x * scale + offsetX
      const y = eye.y * scale + offsetY
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#22d3ee'
      ctx.fill()
    }

    drawEye(leftEye)
    drawEye(rightEye)
  }, [leftEye, rightEye, videoWidth, videoHeight])

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function startCamera() {
    setError(null)
    setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('streaming')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to access webcam')
    }
  }

  function stopCamera() {
    stopStream()
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStatus('idle')
  }

  async function captureImage() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || status !== 'streaming') return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    onCapture?.(imageData, canvas)

    setCaptureUrl(canvas.toDataURL('image/png'))
    setCaptureResult(null)
    setAnalysisError(null)
    setIsAnalyzing(true)

    try {
      const landmarker = await getImageFaceLandmarker()
      setCaptureResult(landmarker.detect(canvas))
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Eye state detection failed',
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="webcam-view">
      <div className="webcam-view__stage">
        <video
          ref={videoRef}
          className="webcam-view__video"
          playsInline
          muted
          style={{ display: status === 'streaming' ? 'block' : 'none' }}
        />
        <canvas
          ref={overlayCanvasRef}
          className="webcam-view__overlay"
          style={{ display: status === 'streaming' ? 'block' : 'none' }}
        />
        {status !== 'streaming' && (
          <div className="webcam-view__placeholder">
            {status === 'starting' && <p>Starting camera…</p>}
            {status === 'idle' && <p>Camera is off</p>}
            {status === 'error' && <p className="webcam-view__error">{error}</p>}
          </div>
        )}
      </div>

      {status === 'streaming' && (
        <p className="webcam-view__eye-readout">
          Left eye: {formatPosition(leftEye)} · Right eye:{' '}
          {formatPosition(rightEye)} · Tilt: {formatDegrees(tiltDegrees)}
        </p>
      )}

      <div className="webcam-view__controls">
        {status !== 'streaming' ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={status === 'starting'}
          >
            {status === 'starting' ? 'Starting…' : 'Start Camera'}
          </button>
        ) : (
          <>
            <button type="button" onClick={captureImage}>
              Capture Image
            </button>
            <button type="button" onClick={stopCamera} className="secondary">
              Stop Camera
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="webcam-view__canvas" hidden />

      {captureUrl && (
        <div className="webcam-view__capture">
          <h3>Last Capture</h3>
          <img src={captureUrl} alt="Captured frame from webcam" />

          <div className="webcam-view__method-slider">
            <span className={method === 'blendshapes' ? 'active' : ''}>
              Blendshapes
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={1}
              value={method === 'ear' ? 1 : 0}
              onChange={(event) =>
                setMethod(event.target.value === '1' ? 'ear' : 'blendshapes')
              }
              aria-label="Eye state detection method"
            />
            <span className={method === 'ear' ? 'active' : ''}>EAR</span>
          </div>

          <p className="webcam-view__eye-state">
            {isAnalyzing && 'Analyzing…'}
            {!isAnalyzing && analysisError && `Error: ${analysisError}`}
            {!isAnalyzing && !analysisError && !eyeState && 'No face detected'}
            {!isAnalyzing && !analysisError && eyeState && (
              <>
                Left eye: {eyeState.left} · Right eye: {eyeState.right}
              </>
            )}
          </p>

          {!isAnalyzing && !analysisError && headPose && (
            <p className="webcam-view__head-pose">
              Pitch: {formatDegrees(headPose.pitch)} · Yaw:{' '}
              {formatDegrees(headPose.yaw)} · Roll:{' '}
              {formatDegrees(headPose.roll)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function formatPosition(position: { x: number; y: number } | null): string {
  if (!position) return 'not detected'
  return `(${Math.round(position.x)}, ${Math.round(position.y)})`
}

function formatDegrees(degrees: number | null): string {
  if (degrees === null) return 'not detected'
  return `${Math.round(degrees)}°`
}

export default WebcamView
