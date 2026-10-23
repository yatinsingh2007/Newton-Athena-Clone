import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog.jsx'
import { QuestionPalette } from '../components/QuestionPalette.jsx'
import { QuestionText } from '../components/QuestionText.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { Timer } from '../components/Timer.jsx'
import { questionStatus, summarize } from '../lib/questionStatus.js'
import { createSaveQueue } from '../lib/saveQueue.js'
import { autoSubmitDue, remainingMs, SUBMIT_RETRY_MS } from '../lib/timer.js'
import './Test.css'

const LETTERS = ['A', 'B', 'C', 'D']

// A monotonic clock: changing the computer's time can't move the countdown.
const monotonicNow = () => performance.now()

const timeLeft = (test, clientNow) =>
  remainingMs({
    startedAt: test.startedAt,
    durationMinutes: test.durationMinutes,
    serverNow: test.now,
    clientNowAtFetch: test.fetchedAt,
    clientNow,
  })

export function Test({ api, session, onSubmitted, onSessionLost }) {
  const [test, setTest] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [marked, setMarked] = useState([])
  const [visited, setVisited] = useState(() => new Set())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const paletteButton = useRef(null)
  const [clock, setClock] = useState(monotonicNow)
  const submitting = useRef(false)
  const autoSubmitRetryAt = useRef(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const latest = useRef({ answers: {}, marked: [] })
  const saveQueue = useRef(null)

  const finished = useEffectEvent((result) => onSubmitted(result))
  const lostSession = useEffectEvent(() => onSessionLost())

  useEffect(() => {
    let cancelled = false
    api.getTest(session.token).then(
      (data) => {
        if (cancelled) return
        if (data.status === 'submitted') return finished(data.result)
        setTest({ ...data, fetchedAt: monotonicNow() })
        setAnswers(data.answers)
        setMarked(data.marked)
        latest.current = { answers: data.answers, marked: data.marked }
        // Resuming: anything answered or marked earlier counts as visited.
        setVisited(new Set([data.questions[0].id, ...Object.keys(data.answers), ...data.marked]))
      },
      (err) => {
        if (cancelled) return
        // The login is no longer valid: send the student back to log in again.
        if (err.status === 401) return lostSession()
        setLoadError(err.message)
      },
    )
    return () => {
      cancelled = true
    }
  }, [api, session.token, loadAttempt])

  function retryLoad() {
    setLoadError(null)
    setLoadAttempt((n) => n + 1)
  }

  // One submit at a time, whether from the dialog or the timer.
  async function submitNow({ auto = false } = {}) {
    if (submitting.current) return
    submitting.current = true
    setSubmitBusy(true)
    setSubmitError(null)
    try {
      // Let a save that's still in flight land first so the server sees one change at a time.
      await saveQueue.current?.flush()
      onSubmitted(await api.submit(session.token, latest.current.answers))
    } catch (err) {
      submitting.current = false
      setSubmitBusy(false)
      // The timer keeps trying on its own, but not on every tick.
      if (auto) autoSubmitRetryAt.current = monotonicNow() + SUBMIT_RETRY_MS
      setSubmitError(auto ? `${err.message} Time is up — retrying automatically…` : err.message)
      setConfirmOpen(true)
    }
  }

  // Time is up: submit whatever has been answered, no confirmation.
  const onTick = useEffectEvent(() => {
    const now = monotonicNow()
    setClock(now)
    if (autoSubmitDue({ remaining: timeLeft(test, now), now, retryAt: autoSubmitRetryAt.current })) {
      submitNow({ auto: true })
    }
  })

  useEffect(() => {
    if (!test) return
    const id = setInterval(onTick, 500)
    return () => clearInterval(id)
  }, [test])

  // A failed save is retried on its own, not only on the next answer change.
  useEffect(() => {
    if (!saveFailed) return
    const id = setInterval(() => saveQueue.current?.enqueue(latest.current), 5000)
    return () => clearInterval(id)
  }, [saveFailed])

  if (loadError) {
    return (
      <div className="test-status">
        <div className="test-status-box">
          <p className="error-text" role="alert">{loadError}</p>
          <button type="button" className="btn btn-primary" onClick={retryLoad}>
            Try again
          </button>
        </div>
      </div>
    )
  }
  if (!test) return <div className="test-status">Loading your test…</div>

  const remaining = timeLeft(test, clock)
  const question = test.questions[index]
  const total = test.questions.length
  const selected = answers[question.id]

  function persist(nextAnswers, nextMarked) {
    setAnswers(nextAnswers)
    setMarked(nextMarked)
    latest.current = { answers: nextAnswers, marked: nextMarked }
    saveQueue.current ??= createSaveQueue({
      save: (state) => api.saveAttempt(session.token, state),
      onSaved: () => setSaveFailed(false),
      onError: (err) => {
        // Submitted elsewhere or out of time: let the server settle the result.
        if (err.status === 409 || err.status === 410) submitNow()
        else setSaveFailed(true)
      },
    })
    saveQueue.current.enqueue(latest.current)
  }

  const goTo = (nextIndex) => {
    setIndex(nextIndex)
    setVisited((v) => new Set(v).add(test.questions[nextIndex].id))
  }
  const statusOf = (qid) => questionStatus(qid, { answers, marked, visited })
  // Build on latest.current, not render state, so quick successive clicks
  // never drop each other's changes.
  const choose = (optionIndex) =>
    persist({ ...latest.current.answers, [question.id]: optionIndex }, latest.current.marked)
  const clearSelection = () => {
    const rest = { ...latest.current.answers }
    delete rest[question.id]
    persist(rest, latest.current.marked)
  }
  const counts = summarize(test.questions, answers, marked)
  const isMarked = marked.includes(question.id)
  const toggleMark = () => {
    const current = latest.current.marked
    const next = current.includes(question.id)
      ? current.filter((id) => id !== question.id)
      : [...current, question.id]
    persist(latest.current.answers, next)
  }

  return (
    <div className="test-shell">
      <header className="test-header">
        <h1 className="test-title">{test.title}</h1>
        <div className="test-header-actions">
          <Timer remaining={remaining} />
          <ThemeToggle />
          <button type="button" className="btn btn-success" onClick={() => setConfirmOpen(true)}>
            Submit Quiz
          </button>
        </div>
      </header>

      <main className="test-body">
        <div className="question-header">
          <p className="question-count">QUESTION {index + 1}/{total}</p>
          <div className="question-tools">
            <button
              type="button"
              className="btn btn-accent-outline"
              aria-pressed={isMarked}
              onClick={toggleMark}
            >
              {isMarked ? 'Marked for review' : 'Mark for review'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={clearSelection}
              disabled={selected === undefined}
            >
              Clear Selection
            </button>
          </div>
        </div>

        <h2 className="question-text">
          <QuestionText text={question.text} />
        </h2>

        <div className="options">
          {question.options.map((option, i) => (
            <button
              key={i}
              type="button"
              className="option"
              aria-pressed={selected === i}
              onClick={() => choose(i)}
            >
              <span className="option-letter">{LETTERS[i]}</span>
              <QuestionText text={option} />
            </button>
          ))}
        </div>
      </main>

      <footer className="test-footer">
        <button type="button" className="btn btn-ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Previous
        </button>
        <button
          type="button"
          ref={paletteButton}
          className="btn palette-toggle"
          aria-label="Show all questions"
          aria-expanded={paletteOpen}
          onClick={() => setPaletteOpen((open) => !open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="2" />
            <rect x="13" y="3" width="8" height="8" rx="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" />
            <rect x="13" y="13" width="8" height="8" rx="2" />
          </svg>
        </button>
        {paletteOpen && (
          <QuestionPalette
            questions={test.questions}
            current={index}
            statusOf={statusOf}
            anchorRef={paletteButton}
            onClose={() => setPaletteOpen(false)}
            onJump={(i) => {
              goTo(i)
              setPaletteOpen(false)
            }}
          />
        )}
        {saveFailed && <span className="save-note">Not saved — retrying…</span>}
        <button type="button" className="btn btn-primary" onClick={() => goTo(index + 1)} disabled={index === total - 1}>
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </footer>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit your test?"
        body={`You've answered ${counts.answered} of ${counts.total} questions. ${counts.marked} marked for review.`}
        confirmLabel="Submit"
        busy={submitBusy}
        error={submitError}
        onConfirm={submitNow}
        onCancel={() => {
          setConfirmOpen(false)
          setSubmitError(null)
        }}
      />
    </div>
  )
}
