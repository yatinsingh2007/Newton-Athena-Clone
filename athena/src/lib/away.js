// The test counts as left when its window isn't focused or can't be seen:
// another app, another desktop, a notification, or the app being hidden.
export const isAway = (doc) => doc.hidden || !doc.hasFocus()

export function formatDuration(ms) {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`
}

// Total time away across { leftAt, backAt } events; one still open counts up to `now`.
export function totalAwayMs(events, now) {
  return events.reduce((sum, e) => sum + Math.max(0, (e.backAt ?? now) - e.leftAt), 0)
}
