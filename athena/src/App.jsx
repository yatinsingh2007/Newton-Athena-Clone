import { useState } from 'react'
import { ThemeToggle } from './components/ThemeToggle.jsx'

function App() {
  const [screen, setScreen] = useState('login')
  const [session, setSession] = useState(null)
  const [result, setResult] = useState(null)

  const onLoggedIn = (nextSession, savedResult) => {
    setSession(nextSession)
    setResult(savedResult)
    setScreen(savedResult ? 'result' : 'check')
  }
  const onReady = () => setScreen('test')
  const onSubmitted = (nextResult) => {
    setResult(nextResult)
    setScreen('result')
  }
  const onLogout = () => {
    setSession(null)
    setResult(null)
    setScreen('login')
  }

  // Placeholder screens until each real screen lands; "Continue" walks the flow.
  const next = {
    login: () => onLoggedIn({ token: null, user: null }, null),
    check: onReady,
    test: () => onSubmitted({ score: 0, total: 10, submittedAt: Date.now() }),
    result: onLogout,
  }

  return (
    <main style={{ padding: 32 }}>
      <ThemeToggle />
      <h1>Athena</h1>
      <p>Screen: {screen} {session?.user?.name} {result && `${result.score}/${result.total}`}</p>
      <button type="button" className="btn btn-primary" onClick={next[screen]}>Continue</button>
    </main>
  )
}

export default App
