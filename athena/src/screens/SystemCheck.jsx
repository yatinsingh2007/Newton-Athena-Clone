import { useEffect, useRef, useState } from 'react'
import { MicMeter } from '../components/MicMeter.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { mediaErrorMessage } from '../lib/mediaErrors.js'
import './SystemCheck.css'

const media = window.athena?.media

const isLive = (track) => track?.readyState === 'live'

function deviceState(ok, asked) {
  if (ok) return 'Working'
  return asked ? 'Not allowed' : 'Not checked'
}

export function SystemCheck({ user, onReady }) {
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [osBlocked, setOsBlocked] = useState(false)
  const [pending, setPending] = useState(false)

  const streamRef = useRef(null)

  useEffect(() => {
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  // Release the camera and mic when leaving this screen; the test never uses them.
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  async function allow() {
    setError(null)
    setOsBlocked(false)
    setPending(true)
    try {
      // Ask the OS first (through main); getUserMedia alone can't trigger the macOS prompt.
      const access = media ? await media.request() : { granted: true }
      if (!access.granted) {
        setOsBlocked(true)
        setError(mediaErrorMessage('NotAllowedError'))
        return
      }
      setStream(await navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
    } catch (err) {
      setError(mediaErrorMessage(err.name))
    } finally {
      setPending(false)
    }
  }

  const cameraOk = isLive(stream?.getVideoTracks()[0])
  const micOk = isLive(stream?.getAudioTracks()[0])

  function start() {
    stream.getTracks().forEach((t) => t.stop())
    onReady()
  }

  return (
    <div className="screen-center">
      <div className="corner-toggle">
        <ThemeToggle />
      </div>
      <div className="card check-card">
        <p className="eyebrow">System check</p>
        <h1>Check your camera and microphone</h1>
        <p className="check-intro">
          Hi {user.name.split(' ')[0]}, both must be working before the test can start.
        </p>

        <div className="check-preview">
          {stream ? (
            <video ref={videoRef} autoPlay muted playsInline aria-label="Your camera preview" />
          ) : (
            <div className="check-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
              Camera preview appears here
            </div>
          )}
        </div>

        <div className="check-status">
          <div className="check-item" data-ok={cameraOk}>
            <span className="check-dot" aria-hidden="true" />
            Camera
            <span className="check-item-state">{deviceState(cameraOk, Boolean(error))}</span>
          </div>
          <div className="check-item" data-ok={micOk}>
            <span className="check-dot" aria-hidden="true" />
            Microphone
            <span className="check-item-state">{deviceState(micOk, Boolean(error))}</span>
          </div>
        </div>

        {micOk && (
          <div className="check-mic">
            Say something — the bar should move.
            <MicMeter stream={stream} />
          </div>
        )}

        {error && (
          <div className="check-error">
            <p className="error-text" role="alert">{error}</p>
          </div>
        )}

        <div className="check-actions">
          {osBlocked && media && (
            <button type="button" className="btn" onClick={() => media.openSettings()}>
              Open System Settings
            </button>
          )}
          {!stream && (
            <button type="button" className="btn btn-primary" onClick={allow} disabled={pending}>
              {pending ? 'Waiting for permission…' : error ? 'Try again' : 'Allow camera & microphone'}
            </button>
          )}
          {stream && (
            <button type="button" className="btn btn-primary" onClick={start} disabled={!cameraOk || !micOk}>
              Start Test
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
