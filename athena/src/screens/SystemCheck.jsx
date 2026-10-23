import { useEffect, useRef, useState } from 'react'
import { MicMeter } from '../components/MicMeter.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { deviceStatusLabel, mediaErrorMessage } from '../lib/mediaErrors.js'
import './SystemCheck.css'

const media = window.athena?.media

const isLive = (track) => track?.readyState === 'live'

export function SystemCheck({ user, onReady }) {
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  // Why the last check failed: a getUserMedia error name, or 'ended' if a device dropped.
  const [errorName, setErrorName] = useState(null)
  const [, setTrackChange] = useState(0)
  const [osBlocked, setOsBlocked] = useState(false)
  const [pending, setPending] = useState(false)

  const streamRef = useRef(null)

  useEffect(() => {
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream
    if (!stream) return
    // A camera unplugged or taken by another app ends its track.
    const onEnded = () => {
      setErrorName('ended')
      setTrackChange((n) => n + 1)
    }
    const tracks = stream.getTracks()
    tracks.forEach((t) => t.addEventListener('ended', onEnded))
    return () => tracks.forEach((t) => t.removeEventListener('ended', onEnded))
  }, [stream])

  // Release the camera and mic when leaving this screen; the test never uses them.
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  async function allow() {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    setErrorName(null)
    setOsBlocked(false)
    setPending(true)
    try {
      // Ask the OS first (through main); getUserMedia alone can't trigger the macOS prompt.
      const access = media ? await media.request() : { granted: true }
      if (!access.granted) {
        setOsBlocked(true)
        setErrorName('NotAllowedError')
        return
      }
      setStream(await navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
    } catch (err) {
      setErrorName(err.name)
    } finally {
      setPending(false)
    }
  }

  const cameraOk = isLive(stream?.getVideoTracks()[0])
  const micOk = isLive(stream?.getAudioTracks()[0])
  const ready = cameraOk && micOk

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
            <span className="check-item-state">{deviceStatusLabel(cameraOk, errorName)}</span>
          </div>
          <div className="check-item" data-ok={micOk}>
            <span className="check-dot" aria-hidden="true" />
            Microphone
            <span className="check-item-state">{deviceStatusLabel(micOk, errorName)}</span>
          </div>
        </div>

        {micOk && (
          <div className="check-mic">
            Say something — the bar should move.
            <MicMeter stream={stream} />
          </div>
        )}

        {errorName && (
          <div className="check-error">
            <p className="error-text" role="alert">{mediaErrorMessage(errorName)}</p>
          </div>
        )}

        <div className="check-actions">
          {osBlocked && media && (
            <button type="button" className="btn" onClick={() => media.openSettings()}>
              Open System Settings
            </button>
          )}
          {ready ? (
            <button type="button" className="btn btn-primary" onClick={start}>
              Start Test
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={allow} disabled={pending}>
              {pending ? 'Waiting for permission…' : errorName ? 'Try again' : 'Allow camera & microphone'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
