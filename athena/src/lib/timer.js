// Time left, using the server's clock: the client clock may be skewed.
export function remainingMs({ startedAt, durationMinutes, serverNow, clientNowAtFetch, clientNow }) {
  const offset = serverNow - clientNowAtFetch
  return Math.max(0, startedAt + durationMinutes * 60_000 - (clientNow + offset))
}

// Seconds round up, so 00:00 only shows when time is really up.
export function formatClock(ms) {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

// Wait between auto-submit attempts when the server can't be reached at 0:00.
export const SUBMIT_RETRY_MS = 5000

export function autoSubmitDue({ remaining, now, retryAt }) {
  return remaining === 0 && now >= retryAt
}
