import { formatClock } from '../lib/timer.js'

export function Timer({ remaining }) {
  const minutesLeft = Math.ceil(remaining / 60_000)
  return (
    <div className="timer" data-low={remaining < 60_000}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9 2h6" />
      </svg>
      <span className="timer-clock" aria-hidden="true">{formatClock(remaining)}</span>
      {/* Changes once a minute, so screen readers aren't flooded every second. */}
      <span className="sr-only" aria-live="polite">
        {minutesLeft} {minutesLeft === 1 ? 'minute' : 'minutes'} left
      </span>
    </div>
  )
}
