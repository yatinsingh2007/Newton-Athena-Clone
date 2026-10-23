import { ThemeToggle } from '../components/ThemeToggle.jsx'
import './Result.css'

function messageFor(score) {
  if (score >= 8) return 'Excellent work!'
  if (score >= 5) return 'Good effort!'
  return 'Keep practicing!'
}

export function Result({ user, result, onLogout }) {
  const percent = Math.round((result.score / result.total) * 100)
  const submitted = new Date(result.submittedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

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
        <p className="result-name">{user.name}</p>

        <p className="result-score">
          {result.score} <span>/ {result.total}</span>
        </p>
        <p className="result-percent">{percent}%</p>
        <p className="result-message">{messageFor(result.score)}</p>
        <p className="result-time">Submitted {submitted}</p>

        <button type="button" className="btn btn-primary" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  )
}
