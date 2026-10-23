import { useCallback, useEffect, useEffectEvent } from 'react'
import { ExamClock } from '../components/ExamClock.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { useServerClock } from '../hooks/useServerClock.js'
import { homeAction } from '../lib/homeAction.js'
import { examPhase, formatClock } from '../lib/timer.js'
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

// One test on the home screen: when it's live, whether it's done, and what's next.
function TestCard({ test, now, onStart, onShowResult }) {
  const clock = { exam: test, now, phase: examPhase(test, now) }
  const action = homeAction(clock)
  const result = test.attempt.result

  return (
    <section className="card home-card" aria-labelledby={`test-${test.id}`}>
      <p className="eyebrow">{test.startsAt == null ? 'Take it any time' : 'Scheduled test'}</p>
      <h2 id={`test-${test.id}`}>{test.title}</h2>

      <dl className="home-details">
        <div>
          <dt>When</dt>
          <dd>
            {test.startsAt == null
              ? 'Any time'
              : `${formatDay(test.startsAt)} · ${formatTime(test.startsAt)} – ${formatTime(test.endsAt)}`}
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{test.durationMinutes} minutes</dd>
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
          <button type="button" className="btn btn-primary" onClick={() => onShowResult(test.id, result)}>
            View result
          </button>
        )}
        {(action === 'start' || action === 'resume') && (
          <button type="button" className="btn btn-primary" onClick={() => onStart(test.id)}>
            {action === 'resume' ? 'Resume test' : 'Start test'}
          </button>
        )}
        {action === 'wait' && (
          <button type="button" className="btn btn-primary" disabled>
            Starts in {formatClock(test.startsAt - now)}
          </button>
        )}
      </div>
    </section>
  )
}

// The first screen after login: every test, when it's live and whether it's done.
export function Home({ api, session, onStart, onShowResult, onLogout }) {
  const load = useCallback(() => api.getTests(session.token), [api, session.token])
  const { data, now, error } = useServerClock(load)
  const lostSession = error?.status === 401
  const logout = useEffectEvent(() => onLogout())

  // The login is no longer valid: back to the login screen.
  useEffect(() => {
    if (lostSession) logout()
  }, [lostSession])
  if (!data) {
    return (
      <div className="screen-center">
        {error ? <p className="error-text" role="alert">{error.message} Retrying…</p> : 'Loading your tests…'}
      </div>
    )
  }

  return (
    <div className="screen-center">
      <div className="corner-toggle">
        <ThemeToggle />
      </div>
      <div className="home-list">
        <div className="home-head">
          <div>
            <p className="eyebrow">Your tests</p>
            <h1>Hi {session.user.name.split(' ')[0]}</h1>
          </div>
          <button type="button" className="btn" onClick={onLogout}>
            Log out
          </button>
        </div>
        {data.tests.map((test) => (
          <TestCard key={test.id} test={test} now={now} onStart={onStart} onShowResult={onShowResult} />
        ))}
      </div>
    </div>
  )
}
