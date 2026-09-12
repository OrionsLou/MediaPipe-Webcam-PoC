import { useState, type ReactNode } from 'react'
import './ConsentGate.css'

const CONSENT_STORAGE_KEY = 'mediapipe-consent-acknowledged'

interface ConsentGateProps {
  children: ReactNode
}

/**
 * Blocks rendering of its children (and therefore any MediaPipe model
 * loading, since that's only ever triggered from within them) until the
 * user acknowledges Google's MediaPipe Tasks metrics-collection disclosure.
 * Acknowledgment is remembered in localStorage so returning users aren't
 * re-prompted every visit.
 */
function ConsentGate({ children }: ConsentGateProps) {
  const [consented, setConsented] = useState(() => {
    try {
      return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  if (consented) {
    return <>{children}</>
  }

  function handleAgree() {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'true')
    } catch {
      // Storage unavailable (e.g. private browsing) — consent still applies
      // for this session via component state, just won't persist.
    }
    setConsented(true)
  }

  return (
    <div className="consent-gate">
      <div
        className="consent-gate__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-gate-title"
      >
        <h2 id="consent-gate-title">Before you continue</h2>

        <p>
          This app uses <strong>MediaPipe Tasks Vision</strong> to process
          your webcam feed and captured images. Per Google's disclosure for
          this library:
        </p>

        <blockquote>
          <p>
            Processing of input data (images, video) happens on-device —
            MediaPipe does not send that input data to Google servers.
          </p>
          <p>
            However, MediaPipe Tasks APIs send metrics about the performance
            and utilization of the APIs to Google, used to measure
            performance, debug, maintain, and improve MediaPipe Tasks, as
            described in Google's Privacy Policy.
          </p>
        </blockquote>

        <p>
          By clicking "I Agree", you consent to this usage-metrics collection
          by Google.
        </p>

        <button type="button" onClick={handleAgree}>
          I Agree
        </button>
      </div>
    </div>
  )
}

export default ConsentGate
