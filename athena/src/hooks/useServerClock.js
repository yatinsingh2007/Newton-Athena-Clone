import { useEffect, useState } from 'react'
import { monotonicNow, RESYNC_MS, serverTime } from '../lib/timer.js'

// Calls `load` now and every RESYNC_MS; its reply must carry the server's `now`.
// Returns that reply, a live server clock counting on from it, and the last
// error. `data` is null until the server has answered once.
export function useServerClock(load) {
  const [sync, setSync] = useState(null)
  const [error, setError] = useState(null)
  const [clientNow, setClientNow] = useState(monotonicNow)

  useEffect(() => {
    let cancelled = false
    const run = () =>
      load().then(
        (data) => {
          if (cancelled) return
          setSync({ data, fetchedAt: monotonicNow() })
          setError(null)
        },
        // Keep counting from the last sync; the next one may get through.
        (err) => !cancelled && setError(err),
      )
    run()
    const id = setInterval(run, RESYNC_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [load])

  useEffect(() => {
    const id = setInterval(() => setClientNow(monotonicNow()), 500)
    return () => clearInterval(id)
  }, [])

  if (!sync) return { data: null, now: null, error }
  const now = serverTime({ serverNow: sync.data.now, clientNowAtFetch: sync.fetchedAt, clientNow })
  return { data: sync.data, now, error }
}
