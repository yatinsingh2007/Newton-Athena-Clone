import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { publicUser } from '../lib/auth.js'
import { updateJson } from '../lib/store.js'
import { allUsers, checkPassword, createAccount, normalizeEmail } from '../lib/users.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isText = (value) => typeof value === 'string'

export function authRoutes({ dataDir }) {
  const router = Router()

  async function startSession(user) {
    const token = randomUUID()
    await updateJson(dataDir, 'sessions.json', {}, (sessions) => ({
      next: { ...sessions, [token]: user.id },
    }))
    return { token, user: publicUser(user) }
  }

  router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {}
    if (!isText(email) || !isText(password) || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = (await allUsers(dataDir)).find((u) => normalizeEmail(u.email) === normalizeEmail(email))
    if (!user || !(await checkPassword(user, password))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    res.json(await startSession(user))
  })

  router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body ?? {}
    if (!isText(name) || !name.trim()) return res.status(400).json({ error: 'Name is required' })
    if (!isText(email) || !EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({ error: 'Enter a valid email' })
    }
    if (!isText(password) || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const user = await createAccount(dataDir, {
      name: name.trim(),
      email: normalizeEmail(email),
      password,
    })
    if (!user) return res.status(409).json({ error: 'An account with this email already exists' })

    res.status(201).json(await startSession(user))
  })

  return router
}
