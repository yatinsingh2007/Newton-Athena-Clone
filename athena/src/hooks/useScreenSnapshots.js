import { useEffect } from 'react'
import { captureFrame, SNAPSHOT_MS } from '../lib/snapshot.js'

// While `stream` is set, sends the proctor a screenshot of it right away and
// then every SNAPSHOT_MS. A failed upload is skipped; the next one may get through.
export function useScreenSnapshots(api, token, stream) {
  useEffect(() => {
    if (!stream) return
    const video = document.createElement('video')
    video.muted = true
    video.srcObject = stream
    let stopped = false

    async function send() {
      const jpeg = await captureFrame(video)
      if (jpeg && !stopped) api.uploadScreen(token, jpeg).catch(() => {})
    }

    let id
    video.play().then(
      () => {
        if (stopped) return
        send()
        id = setInterval(send, SNAPSHOT_MS)
      },
      () => {},
    )
    return () => {
      stopped = true
      clearInterval(id)
      video.srcObject = null
    }
  }, [api, token, stream])
}
