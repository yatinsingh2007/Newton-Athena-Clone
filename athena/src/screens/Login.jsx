import { useState } from 'react'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { ApiError } from '../lib/api.js'
import './Login.css'

export function Login({ api, onLoggedIn, onShowSignup }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const { token, user } = await api.login(email, password)
      let result = null
      try {
        result = await api.getResult(token)
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err
      }
      onLoggedIn({ token, user }, result)
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
      <div className="card login-card">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">A</span>
          Athena
        </div>
        <h1>Log in to your test</h1>
        <p className="login-subtitle">Use the email and password from your institute.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@student.com"
              required
              autoFocus
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="login-switch">
          New here?{' '}
          <button type="button" className="link-button" onClick={onShowSignup}>
            Create an account
          </button>
        </p>
      </div>
    </div>
  )
}
