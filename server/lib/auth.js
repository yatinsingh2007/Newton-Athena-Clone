import { readJson } from './store.js'
import { allUsers } from './users.js'

export function publicUser({ id, name, email }) {
  return { id, name, email }
}

export function requireAuth(dataDir) {
  return async (req, res, next) => {
    const [scheme, token] = (req.get('Authorization') || '').split(' ')
    const sessions = await readJson(dataDir, 'sessions.json', {})
    const userId = scheme === 'Bearer' && token ? sessions[token] : undefined
    const user = userId && (await allUsers(dataDir)).find((u) => u.id === userId)
    if (!user) return res.status(401).json({ error: 'Not logged in' })
    req.user = publicUser(user)
    next()
  }
}
