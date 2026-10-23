import { useEffect, useEffectEvent } from 'react'
import { ExamClock } from '../components/ExamClock.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { useExamClock } from '../hooks/useExamClock.js'
import { homeAction } from '../lib/homeAction.js'
import { formatClock } from '../lib/timer.js'
import './Home.css'

const formatDay = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const formatTime = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const STATUS_LABELS = {
  result: 'Completed',
  resume: 'In progress',
  missed: 'Missed',
  wait: 'Not started',
  start: 'Not started',
}

// The first screen after login: when the test is live and whether it's done.
export function Home({ api, session, onStart, onShowResult, onLogout }) {
  const { clock, error } = useExamClock(api, session.token)
  const lostSession = error?.status === 401
  const logout = useEffectEvent(() => onLogout())

  // The login is no longer valid: back to the login screen.
  useEffect(() => {
    if (lostSession) logout()
  }, [lostSession])
  if (!clock) {
    return (
      <div className="screen-center">
        {error ? <p className="error-text" role="alert">{error.message} Retrying…</p> : 'Loading your test…'}
      </div>
    )
  }

  const { exam } = clock
  const action = homeAction(clock)
  const result = exam.attempt.result

  return (
    <div className="screen-center">
      <div className="corner-toggle">
        <ThemeToggle />
      </div>
      <div className="card home-card">
        <p className="eyebrow">Your test</p>
        <h1>{exam.title}</h1>
        <p className="home-greeting">Hi {session.user.name.split(' ')[0]}.</p>

        <dl className="home-details">
          <div>
            <dt>When</dt>
            <dd>
              {exam.startsAt == null
                ? 'Any time'
                : `${formatDay(exam.startsAt)} · ${formatTime(exam.startsAt)} – ${formatTime(exam.endsAt)}`}
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{exam.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd className="home-badge" data-done={action === 'result'}>
              {STATUS_LABELS[action]}
              {result && ` · ${result.score} / ${result.total}`}
            </dd>
          </div>
        </dl>

        <ExamClock clock={clock} />

        <div className="home-actions">
          {action === 'result' && (
            <button type="button" className="btn btn-primary" onClick={() => onShowResult(result)}>
              View result
            </button>
          )}
          {(action === 'start' || action === 'resume') && (
            <button type="button" className="btn btn-primary" onClick={onStart}>
              {action === 'resume' ? 'Resume test' : 'Start test'}
            </button>
          )}
          {action === 'wait' && (
            <button type="button" className="btn btn-primary" disabled>
              Starts in {formatClock(exam.startsAt - clock.now)}
            </button>
          )}
          <button type="button" className="btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
