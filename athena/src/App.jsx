import { useEffect, useMemo, useState } from 'react'
import { useScreenShare } from './hooks/useScreenShare.js'
import { createApi } from './lib/api.js'
import { readStoredSession, storeSession } from './lib/session.js'
import { Home } from './screens/Home.jsx'
import { Login } from './screens/Login.jsx'
import { Proctor } from './screens/Proctor.jsx'
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
  // The test the student picked on the home screen.
  const [testId, setTestId] = useState(restored?.testId ?? 'exam')
  const [result, setResult] = useState(restored?.result ?? null)
  const screenShare = useScreenShare()
  // The system check, test and result screens only ever talk about this test.
  const testApi = useMemo(() => api.forTest(testId), [testId])

  useEffect(() => {
    storeSession({ session, screen, testId, result })
  }, [session, screen, testId, result])

  const onLoggedIn = (nextSession) => {
    setSession(nextSession)
    setResult(null)
    setScreen(nextSession.user.role === 'proctor' ? 'proctor' : 'home')
  }
  const onStart = (nextTestId) => {
    setTestId(nextTestId)
    setScreen('check')
  }
  const onShowResult = (nextTestId, savedResult) => {
    setTestId(nextTestId)
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

  if (screen === 'proctor') return <Proctor api={api} session={session} onLogout={onLogout} />
  if (screen === 'home') {
    return (
      <Home api={api} session={session} onStart={onStart} onShowResult={onShowResult} onLogout={onLogout} />
    )
  }
  if (screen === 'check') {
    return <SystemCheck api={testApi} session={session} screenShare={screenShare} onReady={onReady} />
  }
  if (screen === 'test') {
    return (
      <Test
        api={testApi}
        session={session}
        screenShare={screenShare}
        onSubmitted={onSubmitted}
        onSessionLost={onLogout}
      />
    )
  }
  if (screen === 'result') {
    return (
      <Result
        api={testApi}
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
