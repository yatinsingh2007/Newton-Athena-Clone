import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { QuestionPalette } from '../components/QuestionPalette.jsx'
import { QuestionText } from '../components/QuestionText.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { Timer } from '../components/Timer.jsx'
import { questionStatus } from '../lib/questionStatus.js'
import { remainingMs } from '../lib/timer.js'
import './Test.css'

const LETTERS = ['A', 'B', 'C', 'D']

export function Test({ api, session, onSubmitted }) {
  const [test, setTest] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [marked, setMarked] = useState([])
  const [visited, setVisited] = useState(() => new Set())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const paletteButton = useRef(null)
  const [clock, setClock] = useState(() => Date.now())
  const submitting = useRef(false)
  const latest = useRef({ answers: {}, marked: [] })
  const saveChain = useRef(Promise.resolve())

  const finished = useEffectEvent((result) => onSubmitted(result))

  useEffect(() => {
    let cancelled = false
    api.getTest(session.token).then(
      (data) => {
        if (cancelled) return
        if (data.status === 'submitted') return finished(data.result)
        setTest({ ...data, fetchedAt: Date.now() })
        setAnswers(data.answers)
        setMarked(data.marked)
        latest.current = { answers: data.answers, marked: data.marked }
        // Resuming: anything answered or marked earlier counts as visited.
        setVisited(new Set([data.questions[0].id, ...Object.keys(data.answers), ...data.marked]))
      },
      (err) => !cancelled && setLoadError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [api, session.token])

  useEffect(() => {
    if (!test) return
    const id = setInterval(() => setClock(Date.now()), 500)
    return () => clearInterval(id)
  }, [test])

  const remaining = test
    ? remainingMs({
        startedAt: test.startedAt,
        durationMinutes: test.durationMinutes,
        serverNow: test.now,
        clientNowAtFetch: test.fetchedAt,
        clientNow: clock,
      })
    : null

  const submitNow = useEffectEvent(async () => {
    if (submitting.current) return
    submitting.current = true
    onSubmitted(await api.submit(session.token, latest.current.answers))
  })

  // Time is up: submit whatever has been answered, no confirmation.
  useEffect(() => {
    if (remaining === 0) submitNow()
  }, [remaining])

  if (loadError) return <div className="test-status" role="alert">{loadError}</div>
  if (!test) return <div className="test-status">Loading your test…</div>

  const question = test.questions[index]
  const total = test.questions.length
  const selected = answers[question.id]

  // Saves run one at a time and always send the newest state, so a slow
  // request can never overwrite a later answer.
  function persist(nextAnswers, nextMarked) {
    setAnswers(nextAnswers)
    setMarked(nextMarked)
    latest.current = { answers: nextAnswers, marked: nextMarked }
    saveChain.current = saveChain.current.then(async () => {
      try {
        await api.saveAttempt(session.token, latest.current)
        setSaveFailed(false)
      } catch (err) {
        // Submitted elsewhere or out of time: let the server settle the result.
        if (err.status === 409 || err.status === 410) {
          onSubmitted(await api.submit(session.token, latest.current.answers))
        } else {
          setSaveFailed(true)
        }
      }
    })
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
          <button type="button" className="btn btn-success">Submit Quiz</button>
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
        {saveFailed && <span className="save-note">Not saved — will retry</span>}
        <button type="button" className="btn btn-primary" onClick={() => goTo(index + 1)} disabled={index === total - 1}>
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </footer>
    </div>
  )
}
