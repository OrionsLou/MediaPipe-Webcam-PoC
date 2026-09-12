import WebcamView from './components/WebcamView'
import ConsentGate from './components/ConsentGate'
import { useFaceLandmarker } from './hooks/useFaceLandmarker'
import './App.css'

function App() {
  return (
    <ConsentGate>
      <AppContent />
    </ConsentGate>
  )
}

function AppContent() {
  const { status, error } = useFaceLandmarker()

  return (
    <main className="app">
      <h1>Webcam MediaPipe PoC</h1>
      <p>Live webcam view with image capture</p>

      <p className="app__model-status">
        Face Landmarker:{' '}
        {status === 'loading' && 'loading model…'}
        {status === 'ready' && 'ready'}
        {status === 'error' && `error — ${error}`}
      </p>

      <WebcamView />
    </main>
  )
}

export default App
