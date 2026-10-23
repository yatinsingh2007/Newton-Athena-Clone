import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { QuestionText } from '../components/QuestionText.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import './Test.css'

const LETTERS = ['A', 'B', 'C', 'D']

export function Test({ api, session, onSubmitted }) {
  const [test, setTest] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [marked, setMarked] = useState([])
  const [saveFailed, setSaveFailed] = useState(false)
  const latest = useRef({ answers: {}, marked: [] })
  const saveChain = useRef(Promise.resolve())

  const finished = useEffectEvent((result) => onSubmitted(result))

  useEffect(() => {
    let cancelled = false
    api.getTest(session.token).then(
      (data) => {
        if (cancelled) return
        if (data.status === 'submitted') return finished(data.result)
        setTest(data)
        setAnswers(data.answers)
        setMarked(data.marked)
        latest.current = { answers: data.answers, marked: data.marked }
      },
      (err) => !cancelled && setLoadError(err.message),
    )
    return () => {
      cancelled = true
    }
  }, [api, session.token])

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

  const goTo = (nextIndex) => setIndex(nextIndex)
  const choose = (optionIndex) => persist({ ...answers, [question.id]: optionIndex }, marked)
  const clearSelection = () => {
    const rest = { ...answers }
    delete rest[question.id]
    persist(rest, marked)
  }
  const isMarked = marked.includes(question.id)
  const toggleMark = () =>
    persist(answers, isMarked ? marked.filter((id) => id !== question.id) : [...marked, question.id])

  return (
    <div className="test-shell">
      <header className="test-header">
        <h1 className="test-title">{test.title}</h1>
        <div className="test-header-actions">
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
