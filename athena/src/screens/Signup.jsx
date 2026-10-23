import { useState } from 'react'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import './Login.css'

export function Signup({ api, onSignedUp, onShowLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const { token, user } = await api.signup(name, email, password)
      onSignedUp({ token, user })
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
        <h1>Create your account</h1>
        <p className="login-subtitle">Sign up to take your test.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            Full name
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="field">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@student.com"
              required
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <span className="field-hint">At least 6 characters</span>
          </label>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="login-switch">
          Already have an account?{' '}
          <button type="button" className="link-button" onClick={onShowLogin}>
            Log in
          </button>
        </p>
      </div>
    </div>
  )
}
