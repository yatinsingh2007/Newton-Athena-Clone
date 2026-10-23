export const SESSION_KEY = 'athena-session'

const SCREENS = new Set(['home', 'check', 'test', 'result', 'proctor'])

// Turns what was stored into { session, screen, testId, result }, or null if
// it's unusable. Sessions stored before there was more than one test are on the exam.
export function parseStoredSession(raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const { token, user, screen, testId = 'exam', result = null } = data ?? {}
  if (typeof token !== 'string' || !token || typeof user?.name !== 'string') return null
  if (!SCREENS.has(screen) || (screen === 'result' && !result) || typeof testId !== 'string') return null
  return { session: { token, user }, screen, testId, result }
}

export function readStoredSession() {
  try {
    return parseStoredSession(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

// Remembers who is logged in and where they are, so a reload picks up from there.
export function storeSession({ session, screen, testId, result }) {
  try {
    if (!session || !SCREENS.has(screen)) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, screen, testId, result }))
  } catch {
    // Storage can be unavailable; a reload then just asks to log in again.
  }
}
