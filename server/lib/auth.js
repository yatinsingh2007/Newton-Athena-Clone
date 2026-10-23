import { readJson } from './store.js'
import { allUsers } from './users.js'

// Everyone is a student unless users.json says `"role": "proctor"`.
export function publicUser({ id, name, email, role = 'student' }) {
  return { id, name, email, role }
}

// With `role`, only users with that role get through; others get a 403.
export function requireAuth(dataDir, role) {
  return async (req, res, next) => {
    const [scheme, token] = (req.get('Authorization') || '').split(' ')
    const sessions = await readJson(dataDir, 'sessions.json', {})
    const userId = scheme === 'Bearer' && token ? sessions[token] : undefined
    const user = userId && (await allUsers(dataDir)).find((u) => u.id === userId)
    if (!user) return res.status(401).json({ error: 'Not logged in' })
    req.user = publicUser(user)
    if (role && req.user.role !== role) return res.status(403).json({ error: 'Not allowed' })
    next()
  }
}
