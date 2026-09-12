import { useEffect, useRef, useState } from 'react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { getFaceLandmarker } from '../mediapipe/faceLandmarker'

type LoadStatus = 'loading' | 'ready' | 'error'

interface UseFaceLandmarkerResult {
  faceLandmarker: FaceLandmarker | null
  status: LoadStatus
  error: string | null
}

/**
 * Loads the FaceLandmarker model once and exposes its status.
 */
export function useFaceLandmarker(): UseFaceLandmarkerResult {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(
    null,
  )
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    getFaceLandmarker()
      .then((landmarker) => {
        if (cancelledRef.current) return
        setFaceLandmarker(landmarker)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelledRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load model')
        setStatus('error')
      })

    return () => {
      cancelledRef.current = true
    }
  }, [])

  return { faceLandmarker, status, error }
}
