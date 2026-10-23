import { useCallback, useEffect, useState } from 'react'
import { ExamClock } from '../components/ExamClock.jsx'
import { Screenshot } from '../components/Screenshot.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { attemptLabel, formatAgo, screenState, sortStudents } from '../lib/proctor.js'
import { examPhase, monotonicNow, serverTime } from '../lib/timer.js'
import './Proctor.css'

const REFRESH_MS = 10_000

const formatTime = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

const SCREEN_LABELS = { live: 'Live screen', stale: 'Screen not coming through', done: 'Last screen' }

// Polls `load` every REFRESH_MS; returns its latest data, when it arrived, and the last error.
function usePolling(load) {
  const [state, setState] = useState({ data: null, fetchedAt: 0, error: null })
  useEffect(() => {
    let cancelled = false
    const run = () =>
      load().then(
        (data) => !cancelled && setState({ data, fetchedAt: monotonicNow(), error: null }),
        (error) => !cancelled && setState((s) => ({ ...s, error })),
      )
    run()
    const id = setInterval(run, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [load])
  return state
}

function useTick() {
  const [clientNow, setClientNow] = useState(monotonicNow)
  useEffect(() => {
    const id = setInterval(() => setClientNow(monotonicNow()), 1000)
    return () => clearInterval(id)
  }, [])
  return clientNow
}

function StudentDetail({ api, token, student, onBack }) {
  const load = useCallback(() => api.proctorScreens(token, student.id), [api, token, student.id])
  const { data } = usePolling(load)
  const [picked, setPicked] = useState(null)
  const shots = [...(data?.screenshots ?? [])].reverse()
  const shown = picked ?? shots[0]

  return (
    <div className="proctor-detail">
      <div className="proctor-detail-head">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← All students
        </button>
        <div>
          <h2>{student.name}</h2>
          <p>
            {student.email} · {attemptLabel(student.attempt)}
          </p>
        </div>
      </div>

      {shown ? (
        <figure className="proctor-detail-shot">
          <Screenshot
            api={api}
            token={token}
            studentId={student.id}
            takenAt={shown}
            alt={`${student.name}'s screen at ${formatTime(shown)}`}
            className="proctor-shot-large"
          />
          <figcaption>
            {formatTime(shown)}
            {shown === shots[0] ? ' · latest' : ''}
          </figcaption>
        </figure>
      ) : (
        <p className="proctor-empty">{data ? 'No screenshots from this student yet.' : 'Loading…'}</p>
      )}

      {shots.length > 1 && (
        <ul className="proctor-strip" aria-label="Earlier screenshots">
          {shots.map((at) => (
            <li key={at}>
              <button type="button" aria-pressed={at === shown} onClick={() => setPicked(at === shots[0] ? null : at)}>
                <Screenshot api={api} token={token} studentId={student.id} takenAt={at} alt="" className="proctor-shot-thumb" />
                <span>{formatTime(at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// What a proctor sees after logging in: every student's progress and screen.
export function Proctor({ api, session, onLogout }) {
  const load = useCallback(() => api.proctorStudents(session.token), [api, session.token])
  const { data, fetchedAt, error } = usePolling(load)
  const clientNow = useTick()
  const [selectedId, setSelectedId] = useState(null)

  const lostSession = error?.status === 401 || error?.status === 403
  useEffect(() => {
    if (lostSession) onLogout()
  }, [lostSession, onLogout])

  const now = data ? serverTime({ serverNow: data.exam.now, clientNowAtFetch: fetchedAt, clientNow }) : 0
  const clock = data && { exam: data.exam, now, phase: examPhase(data.exam, now) }
  const students = data ? sortStudents(data.students) : []
  const selected = students.find((s) => s.id === selectedId)
  const inTest = students.filter((s) => s.attempt.status === 'in_progress').length
  const submitted = students.filter((s) => s.attempt.status === 'submitted').length

  return (
    <div className="proctor-shell">
      <header className="proctor-header">
        <div>
          <p className="eyebrow">Proctor</p>
          <h1>{data?.exam.title ?? 'Loading…'}</h1>
        </div>
        <div className="proctor-header-actions">
          <ThemeToggle />
          <button type="button" className="btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {error && !lostSession && (
        <p className="error-text" role="alert">
          {error.message} Retrying…
        </p>
      )}

      {data && (
        <>
          <div className="proctor-summary">
            <ExamClock clock={clock} />
            <p>
              {students.length} students · {inTest} in the test · {submitted} submitted
            </p>
          </div>

          {selected ? (
            <StudentDetail
              key={selected.id}
              api={api}
              token={session.token}
              student={selected}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <ul className="proctor-grid">
              {students.map((student) => {
                const state = screenState(student, now)
                return (
                  <li key={student.id}>
                    <button type="button" className="proctor-card" data-screen={state} onClick={() => setSelectedId(student.id)}>
                      {student.lastScreenshotAt ? (
                        <Screenshot
                          api={api}
                          token={session.token}
                          studentId={student.id}
                          takenAt={student.lastScreenshotAt}
                          alt={`${student.name}'s latest screen`}
                          className="proctor-shot"
                        />
                      ) : (
                        <div className="proctor-shot screenshot-empty">No screen yet</div>
                      )}
                      <span className="proctor-card-name">{student.name}</span>
                      <span className="proctor-card-status">{attemptLabel(student.attempt)}</span>
                      {student.lastScreenshotAt && (
                        <span className="proctor-card-screen">
                          {SCREEN_LABELS[state]} · {formatAgo(now - student.lastScreenshotAt)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
