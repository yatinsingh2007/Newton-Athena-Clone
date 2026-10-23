// A screenshot is due every 15 seconds; this long without one means the
// student's screen isn't coming through.
export const STALE_SCREEN_MS = 45_000

// 'none' (never sent one), 'live', 'stale' (in the test but no recent screen),
// or 'done' (not in the test right now).
export function screenState(student, now) {
  if (student.lastScreenshotAt == null) return 'none'
  if (student.attempt.status !== 'in_progress') return 'done'
  return now - student.lastScreenshotAt > STALE_SCREEN_MS ? 'stale' : 'live'
}

export function attemptLabel(attempt) {
  if (attempt.status === 'submitted') return `Submitted · ${attempt.score} / ${attempt.total}`
  if (attempt.status === 'in_progress') return 'In test'
  return 'Not started'
}

export function formatAgo(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

// Students in the test first, then those who submitted, then the rest; by name within each.
const ORDER = { in_progress: 0, submitted: 1, not_started: 2 }
export function sortStudents(students) {
  return [...students].sort(
    (a, b) => ORDER[a.attempt.status] - ORDER[b.attempt.status] || a.name.localeCompare(b.name),
  )
}
