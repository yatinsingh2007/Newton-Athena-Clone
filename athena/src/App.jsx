import { useState } from 'react'
import { createApi } from './lib/api.js'
import { Login } from './screens/Login.jsx'
import { Result } from './screens/Result.jsx'
import { Signup } from './screens/Signup.jsx'
import { SystemCheck } from './screens/SystemCheck.jsx'
import { Test } from './screens/Test.jsx'

const api = createApi()

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

  if (screen === 'check') return <SystemCheck user={session.user} onReady={onReady} />
  if (screen === 'test') return <Test api={api} session={session} onSubmitted={onSubmitted} onSessionLost={onLogout} />
  if (screen === 'result') return <Result user={session.user} result={result} onLogout={onLogout} />
  if (screen === 'signup') {
    return <Signup api={api} onSignedUp={onLoggedIn} onShowLogin={() => setScreen('login')} />
  }
  return <Login api={api} onLoggedIn={onLoggedIn} onShowSignup={() => setScreen('signup')} />
}

export default App
