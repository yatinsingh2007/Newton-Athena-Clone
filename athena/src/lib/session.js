export const SESSION_KEY = 'athena-session'

const SCREENS = new Set(['home', 'check', 'test', 'result'])

// Turns what was stored into { session, screen, result }, or null if it's unusable.
export function parseStoredSession(raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const { token, user, screen, result = null } = data ?? {}
  if (typeof token !== 'string' || !token || typeof user?.name !== 'string') return null
  if (!SCREENS.has(screen) || (screen === 'result' && !result)) return null
  return { session: { token, user }, screen, result }
}

export function readStoredSession() {
  try {
    return parseStoredSession(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

// Remembers who is logged in and where they are, so a reload picks up from there.
export function storeSession({ session, screen, result }) {
  try {
    if (!session || !SCREENS.has(screen)) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, screen, result }))
  } catch {
    // Storage can be unavailable; a reload then just asks to log in again.
  }
}
