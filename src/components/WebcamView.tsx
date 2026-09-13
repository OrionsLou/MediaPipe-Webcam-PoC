import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  FaceLandmarkerResult,
  ImageSegmenterResult,
} from '@mediapipe/tasks-vision'
import { useEyeTracking } from '../hooks/useEyeTracking'
import { getImageFaceLandmarker } from '../mediapipe/faceLandmarker'
import {
  getImageSegmenter,
  getMulticlassImageSegmenter,
} from '../mediapipe/imageSegmenter'
import {
  getEyeStateFromBlendshapes,
  getEyeStateFromEAR,
  type EyeDetectionMethod,
} from '../mediapipe/eyeState'
import { getHeadPoseFromMatrix, isHeadTilted } from '../mediapipe/headPose'
import { getFaceBoundingBox } from '../mediapipe/faceBoundingBox'
import { cropToBoundingBox } from '../mediapipe/cropToBoundingBox'
import {
  replaceBackgroundWithCategoryMask,
  replaceBackgroundWithConfidenceMask,
  replaceBackgroundWithMulticlassMask,
  type SegmentationMethod,
} from '../mediapipe/backgroundReplace'
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

  const [segmentationResult, setSegmentationResult] =
    useState<ImageSegmenterResult | null>(null)
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [segmentationError, setSegmentationError] = useState<string | null>(
    null,
  )
  const [segmentationMethod, setSegmentationMethod] =
    useState<SegmentationMethod>('category')

  const [multiclassResult, setMulticlassResult] =
    useState<ImageSegmenterResult | null>(null)
  const [isMulticlassSegmenting, setIsMulticlassSegmenting] = useState(false)
  const [multiclassSegmentationError, setMulticlassSegmentationError] =
    useState<string | null>(null)

  const { leftEye, rightEye, videoWidth, videoHeight, tiltDegrees, faceBoundingBox } =
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

  const tilted = headPose ? isHeadTilted(headPose) : null

  // Face bounding box for the captured still (distinct from the live-view
  // one) — used to crop the background-removed result to a
  // passport-photo-style headshot.
  const captureFaceBoundingBox = useMemo(() => {
    const landmarks = captureResult?.faceLandmarks?.[0]
    const canvas = canvasRef.current
    if (!landmarks || !canvas) return null
    return getFaceBoundingBox(landmarks, canvas.width, canvas.height)
  }, [captureResult])

  const backgroundReplacedUrl = useMemo(() => {
    const canvas = canvasRef.current
    if (!canvas) return null

    let output = null
    if (segmentationMethod === 'multiclass') {
      output = multiclassResult
        ? replaceBackgroundWithMulticlassMask(canvas, multiclassResult)
        : null
    } else if (segmentationResult) {
      output =
        segmentationMethod === 'category'
          ? replaceBackgroundWithCategoryMask(canvas, segmentationResult)
          : replaceBackgroundWithConfidenceMask(canvas, segmentationResult)
    }

    if (output && captureFaceBoundingBox) {
      output = cropToBoundingBox(output, captureFaceBoundingBox)
    }

    return output ? output.toDataURL('image/png') : null
  }, [
    segmentationResult,
    multiclassResult,
    segmentationMethod,
    captureFaceBoundingBox,
  ])

  const isSegmentingActive =
    segmentationMethod === 'multiclass' ? isMulticlassSegmenting : isSegmenting
  const segmentationErrorActive =
    segmentationMethod === 'multiclass'
      ? multiclassSegmentationError
      : segmentationError

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

    if (faceBoundingBox) {
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = 2
      ctx.strokeRect(
        faceBoundingBox.x * scale + offsetX,
        faceBoundingBox.y * scale + offsetY,
        faceBoundingBox.width * scale,
        faceBoundingBox.height * scale,
      )
    }

    drawEye(leftEye)
    drawEye(rightEye)
  }, [leftEye, rightEye, videoWidth, videoHeight, faceBoundingBox])

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

    setSegmentationResult(null)
    setSegmentationError(null)
    setIsSegmenting(true)

    setMulticlassResult(null)
    setMulticlassSegmentationError(null)
    setIsMulticlassSegmenting(true)

    void analyzeFace(canvas)
    void analyzeSegmentation(canvas)
    void analyzeMulticlassSegmentation(canvas)
  }

  async function analyzeFace(canvas: HTMLCanvasElement) {
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

  async function analyzeSegmentation(canvas: HTMLCanvasElement) {
    try {
      const segmenter = await getImageSegmenter()
      setSegmentationResult(segmenter.segment(canvas))
    } catch (err) {
      setSegmentationError(
        err instanceof Error ? err.message : 'Background segmentation failed',
      )
    } finally {
      setIsSegmenting(false)
    }
  }

  async function analyzeMulticlassSegmentation(canvas: HTMLCanvasElement) {
    try {
      const segmenter = await getMulticlassImageSegmenter()
      setMulticlassResult(segmenter.segment(canvas))
    } catch (err) {
      setMulticlassSegmentationError(
        err instanceof Error ? err.message : 'Background segmentation failed',
      )
    } finally {
      setIsMulticlassSegmenting(false)
    }
  }

  return (
    <div className="webcam-view">
      <section className="webcam-view__panel">
        <h3>Live View</h3>

        <div className="webcam-view__media webcam-view__stage">
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
            <div className="webcam-view__placeholder-text">
              {status === 'starting' && <p>Starting camera…</p>}
              {status === 'idle' && <p>Camera is off</p>}
              {status === 'error' && (
                <p className="webcam-view__error">{error}</p>
              )}
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
      </section>

      {captureUrl && (
        <section className="webcam-view__panel">
          <h3>Last Capture</h3>

          <img
            className="webcam-view__media"
            src={captureUrl}
            alt="Captured frame from webcam"
          />

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

          {!isAnalyzing && !analysisError && tilted !== null && (
            <p className="webcam-view__head-pose">
              {tilted ? 'Head is tilted' : 'Head is not tilted'}
            </p>
          )}
        </section>
      )}

      {captureUrl && (
        <section className="webcam-view__panel">
          <h3>Background Removal</h3>

          {backgroundReplacedUrl ? (
            <img
              className="webcam-view__media webcam-view__media--contain"
              src={backgroundReplacedUrl}
              alt="Face cropped to a passport-photo-style headshot with background replaced by white"
            />
          ) : (
            <div className="webcam-view__media">
              <div className="webcam-view__placeholder-text">
                {isSegmentingActive && <p>Segmenting…</p>}
                {!isSegmentingActive && segmentationErrorActive && (
                  <p className="webcam-view__error">
                    {segmentationErrorActive}
                  </p>
                )}
                {!isSegmentingActive && !segmentationErrorActive && (
                  <p>Segmentation unavailable</p>
                )}
              </div>
            </div>
          )}

          <select
            className="webcam-view__method-select"
            value={segmentationMethod}
            onChange={(event) =>
              setSegmentationMethod(event.target.value as SegmentationMethod)
            }
            aria-label="Background segmentation method"
          >
            <option value="category">Category Mask</option>
            <option value="confidence">Confidence Mask</option>
            <option value="multiclass">Multiclass</option>
          </select>
        </section>
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
