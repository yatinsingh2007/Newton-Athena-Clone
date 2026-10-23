import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { publicUser } from '../lib/auth.js'
import { readJson, updateJson } from '../lib/store.js'

export function authRoutes({ dataDir }) {
  const router = Router()

  router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {}
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const users = await readJson(dataDir, 'users.json', [])
    const user = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    )
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const token = randomUUID()
    await updateJson(dataDir, 'sessions.json', {}, (sessions) => ({
      next: { ...sessions, [token]: user.id },
    }))

    res.json({ token, user: publicUser(user) })
  })

  return router
}
