import { useEffect, useState } from 'react'
import { isAway } from '../lib/away.js'

const RETRY_MS = 5000

// While `active`, reports to the server each time the student leaves the test
// window and comes back. Returns how often they've left in this session and,
// once they're back, how long the last time was (null until they leave).
export function useAwayTracking(api, token, active) {
  const [count, setCount] = useState(0)
  const [lastAwayMs, setLastAwayMs] = useState(null)

  useEffect(() => {
    if (!active) return
    let away = false
    let leftAt = 0
    let retry

    // Sends the current state; if it doesn't get through, tries again shortly.
    function report() {
      clearTimeout(retry)
      const state = away
      api.reportAway(token, state).catch((err) => {
        // Time is up or the test was submitted: nothing left to report to.
        if (err.status === 409 || err.status === 410) return
        retry = setTimeout(() => away === state && report(), RETRY_MS)
      })
    }

    function check() {
      const now = isAway(document)
      if (now === away) return
      away = now
      if (away) {
        leftAt = performance.now()
        setCount((n) => n + 1)
      } else {
        setLastAwayMs(performance.now() - leftAt)
      }
      report()
    }

    window.addEventListener('blur', check)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    check()
    return () => {
      clearTimeout(retry)
      window.removeEventListener('blur', check)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [api, token, active])

  return { count, lastAwayMs, dismiss: () => setLastAwayMs(null) }
}
