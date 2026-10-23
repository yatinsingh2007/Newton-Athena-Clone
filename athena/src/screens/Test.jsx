import { useEffect, useEffectEvent, useState } from 'react'
import { QuestionText } from '../components/QuestionText.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import './Test.css'

const LETTERS = ['A', 'B', 'C', 'D']

export function Test({ api, session, onSubmitted }) {
  const [test, setTest] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [index] = useState(0)
  const [answers, setAnswers] = useState({})

  const finished = useEffectEvent((result) => onSubmitted(result))

  useEffect(() => {
    let cancelled = false
    api.getTest(session.token).then(
      (data) => {
        if (cancelled) return
        if (data.status === 'submitted') return finished(data.result)
        setTest(data)
        setAnswers(data.answers)
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

  const choose = (optionIndex) => setAnswers({ ...answers, [question.id]: optionIndex })

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

      <footer className="test-footer" />
    </div>
  )
}
