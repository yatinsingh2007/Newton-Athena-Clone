import { useEffect, useState } from 'react'
import { isWholeScreen } from '../lib/screenShare.js'

const screenApi = window.athena?.screen

const stopAll = (stream) => stream?.getTracks().forEach((t) => t.stop())

// The student's shared screen, kept from the system check through the whole test.
// `error` is why sharing isn't on: a getDisplayMedia error name, 'blocked'
// (no macOS permission), 'window' (not the whole screen) or 'ended'.
export function useScreenShare() {
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  // Stopped from the OS, or the screen went away.
  useEffect(() => {
    const track = stream?.getVideoTracks()[0]
    if (!track) return
    const onEnded = () => {
      setStream(null)
      setError('ended')
    }
    track.addEventListener('ended', onEnded)
    return () => track.removeEventListener('ended', onEnded)
  }, [stream])

  async function start() {
    setError(null)
    setPending(true)
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      })
      // Without the macOS permission the capture only shows the wallpaper.
      if ((await screenApi?.getStatus()) === 'denied') {
        stopAll(next)
        return setError('blocked')
      }
      if (!isWholeScreen(next.getVideoTracks()[0])) {
        stopAll(next)
        return setError('window')
      }
      stopAll(stream)
      setStream(next)
    } catch (err) {
      setError(err.name)
    } finally {
      setPending(false)
    }
  }

  function stop() {
    stopAll(stream)
    setStream(null)
    setError(null)
  }

  const live = stream?.getVideoTracks()[0]?.readyState === 'live'
  return { stream, live, error, pending, start, stop, openSettings: screenApi?.openSettings }
}
