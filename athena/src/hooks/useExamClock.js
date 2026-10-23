import { useEffect, useState } from 'react'
import { examPhase, monotonicNow, RESYNC_MS, serverTime } from '../lib/timer.js'

// The exam's schedule and a live server clock, re-synced every RESYNC_MS.
// `clock` is null until the server has answered once; `error` is the last failure.
export function useExamClock(api, token) {
  const [sync, setSync] = useState(null)
  const [error, setError] = useState(null)
  const [clientNow, setClientNow] = useState(monotonicNow)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      api.getExam(token).then(
        (exam) => {
          if (cancelled) return
          setSync({ exam, fetchedAt: monotonicNow() })
          setError(null)
        },
        // Keep counting from the last sync; the next one may get through.
        (err) => !cancelled && setError(err),
      )
    load()
    const id = setInterval(load, RESYNC_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [api, token])

  useEffect(() => {
    const id = setInterval(() => setClientNow(monotonicNow()), 500)
    return () => clearInterval(id)
  }, [])

  if (!sync) return { clock: null, error }
  const now = serverTime({ serverNow: sync.exam.now, clientNowAtFetch: sync.fetchedAt, clientNow })
  return { clock: { exam: sync.exam, now, phase: examPhase(sync.exam, now) }, error }
}
