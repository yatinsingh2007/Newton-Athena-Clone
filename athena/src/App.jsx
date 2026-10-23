import { useEffect, useState } from 'react'
import { useScreenShare } from './hooks/useScreenShare.js'
import { createApi } from './lib/api.js'
import { readStoredSession, storeSession } from './lib/session.js'
import { Home } from './screens/Home.jsx'
import { Login } from './screens/Login.jsx'
import { Result } from './screens/Result.jsx'
import { Signup } from './screens/Signup.jsx'
import { SystemCheck } from './screens/SystemCheck.jsx'
import { Test } from './screens/Test.jsx'

const api = createApi()

// After a reload, go back to where the student was. The test itself (answers,
// marks and the countdown) is kept on the server, so it carries on from there.
const restored = readStoredSession()

function App() {
  const [screen, setScreen] = useState(restored?.screen ?? 'login')
  const [session, setSession] = useState(restored?.session ?? null)
  const [result, setResult] = useState(restored?.result ?? null)
  const screenShare = useScreenShare()

  useEffect(() => {
    storeSession({ session, screen, result })
  }, [session, screen, result])

  const onLoggedIn = (nextSession) => {
    setSession(nextSession)
    setResult(null)
    setScreen('home')
  }
  const onShowResult = (savedResult) => {
    setResult(savedResult)
    setScreen('result')
  }
  const onReady = () => setScreen('test')
  const onRetake = () => {
    setResult(null)
    setScreen('check')
  }
  const onSubmitted = (nextResult) => {
    screenShare.stop()
    setResult(nextResult)
    setScreen('result')
  }
  const onLogout = () => {
    screenShare.stop()
    setSession(null)
    setResult(null)
    setScreen('login')
  }

  if (screen === 'home') {
    return (
      <Home
        api={api}
        session={session}
        onStart={() => setScreen('check')}
        onShowResult={onShowResult}
        onLogout={onLogout}
      />
    )
  }
  if (screen === 'check') return (
      <SystemCheck api={api} session={session} screenShare={screenShare} onReady={onReady} />
    )
  if (screen === 'test') return <Test api={api} session={session} onSubmitted={onSubmitted} onSessionLost={onLogout} />
  if (screen === 'result') {
    return (
      <Result
        api={api}
        session={session}
        result={result}
        onRetake={onRetake}
        onHome={() => setScreen('home')}
        onLogout={onLogout}
      />
    )
  }
  if (screen === 'signup') {
    return <Signup api={api} onSignedUp={onLoggedIn} onShowLogin={() => setScreen('login')} />
  }
  return <Login api={api} onLoggedIn={onLoggedIn} onShowSignup={() => setScreen('signup')} />
}

export default App
