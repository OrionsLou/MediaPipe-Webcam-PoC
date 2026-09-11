import { useEffect, useRef, useState } from 'react'
import './WebcamView.css'

interface WebcamViewProps {
  onCapture?: (imageData: ImageData, canvas: HTMLCanvasElement) => void
}

type CameraStatus = 'idle' | 'starting' | 'streaming' | 'error'

function WebcamView({ onCapture }: WebcamViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [captureUrl, setCaptureUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function captureImage() {
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
        {status !== 'streaming' && (
          <div className="webcam-view__placeholder">
            {status === 'starting' && <p>Starting camera…</p>}
            {status === 'idle' && <p>Camera is off</p>}
            {status === 'error' && <p className="webcam-view__error">{error}</p>}
          </div>
        )}
      </div>

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
        </div>
      )}
    </div>
  )
}

export default WebcamView
