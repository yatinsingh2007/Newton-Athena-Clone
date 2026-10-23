import { useState } from 'react'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import './Result.css'

function messageFor(score) {
  if (score >= 8) return 'Excellent work!'
  if (score >= 5) return 'Good effort!'
  return 'Keep practicing!'
}

const formatTime = (ms) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function Result({ api, session, result, onRetake, onHome, onLogout }) {
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const percent = Math.round((result.score / result.total) * 100)
  const previous = result.previous ?? []

  async function retake() {
    setError(null)
    setPending(true)
    try {
      await api.retake(session.token)
      onRetake()
    } catch (err) {
      setError(err.message)
      setPending(false)
    }
  }

  return (
    <div className="screen-center">
      <div className="corner-toggle">
        <ThemeToggle />
      </div>
      <div className="card result-card">
        <div className="result-check" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1>Test submitted</h1>
        <p className="result-name">{session.user.name}</p>

        <p className="result-score">
          {result.score} <span>/ {result.total}</span>
        </p>
        <p className="result-percent">{percent}%</p>
        <p className="result-message">{messageFor(result.score)}</p>
        <p className="result-time">Submitted {formatTime(result.submittedAt)}</p>

        {previous.length > 0 && (
          <div className="result-history">
            <p className="eyebrow">Earlier attempts</p>
            <ul>
              {previous.map((attempt) => (
                <li key={attempt.submittedAt}>
                  <span>{formatTime(attempt.submittedAt)}</span>
                  <strong>
                    {attempt.score} / {attempt.total}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="error-text result-error" role="alert">{error}</p>}
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={retake} disabled={pending}>
            {pending ? 'Starting…' : 'Reattempt test'}
          </button>
          <button type="button" className="btn" onClick={onHome} disabled={pending}>
            Home
          </button>
          <button type="button" className="btn" onClick={onLogout} disabled={pending}>
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
