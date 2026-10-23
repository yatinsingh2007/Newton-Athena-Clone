import { formatClock } from '../lib/timer.js'

// The exam window as the student sees it after logging in: starting soon, live, or over.
export function ExamClock({ clock }) {
  if (!clock || clock.phase === 'anytime') return null
  const { exam, now, phase } = clock
  return (
    <div className="exam-clock" data-phase={phase} role="status">
      {phase === 'upcoming' && (
        <>
          Test starts in <strong>{formatClock(exam.startsAt - now)}</strong>
        </>
      )}
      {phase === 'open' && (
        <>
          Test is live · <strong>{formatClock(exam.endsAt - now)}</strong> left
        </>
      )}
      {phase === 'closed' && 'The test window has closed.'}
    </div>
  )
}
