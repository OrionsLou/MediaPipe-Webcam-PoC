import WebcamView from './components/WebcamView'
import './App.css'

function App() {
  return (
    <main className="app">
      <h1>Webcam MediaPipe POC</h1>
      <p>Live webcam view with image capture</p>
      <WebcamView />
    </main>
  )
}

export default App
