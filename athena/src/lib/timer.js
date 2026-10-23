// A monotonic clock: changing the computer's time can't move the countdown.
export const monotonicNow = () => performance.now()

// How often the app re-reads the server's clock while a countdown is on screen.
export const RESYNC_MS = 30_000

// The server's time now, from a server timestamp and the monotonic time it arrived.
export function serverTime({ serverNow, clientNowAtFetch, clientNow }) {
  return serverNow + (clientNow - clientNowAtFetch)
}

// Time left until `endsAt`, using the server's clock: the client clock may be skewed.
export function remainingMs({ endsAt, serverNow, clientNowAtFetch, clientNow }) {
  return Math.max(0, endsAt - serverTime({ serverNow, clientNowAtFetch, clientNow }))
}

// Where a fixed exam window stands at server time `now`; 'anytime' if there's no window.
export function examPhase({ startsAt, endsAt }, now) {
  if (startsAt == null) return 'anytime'
  if (now < startsAt) return 'upcoming'
  if (now < endsAt) return 'open'
  return 'closed'
}

// Seconds round up, so 00:00 only shows when time is really up.
export function formatClock(ms) {
  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
}

// Wait between auto-submit attempts when the server can't be reached at 0:00.
export const SUBMIT_RETRY_MS = 5000

export function autoSubmitDue({ remaining, now, retryAt }) {
  return remaining === 0 && now >= retryAt
}
