import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { readJson, updateJson } from './store.js'

const scryptAsync = promisify(scrypt)

// users.json holds the demo students; accounts.json holds students who signed up.
export async function allUsers(dataDir) {
  const [seeded, accounts] = await Promise.all([
    readJson(dataDir, 'users.json', []),
    readJson(dataDir, 'accounts.json', []),
  ])
  return [...seeded, ...accounts]
}

export const normalizeEmail = (email) => email.trim().toLowerCase()

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scryptAsync(password, salt, 64)
  return `${salt}:${hash.toString('hex')}`
}

// Demo users keep a plain `password`; signed-up accounts store `passwordHash`.
export async function checkPassword(user, password) {
  if (!user.passwordHash) return user.password === password
  const [salt, hash] = user.passwordHash.split(':')
  const attempt = await scryptAsync(password, salt, 64)
  return timingSafeEqual(attempt, Buffer.from(hash, 'hex'))
}

// Returns the new user, or null if the email is taken. The check and the write
// happen under one lock so two signups can't both claim an email.
export async function createAccount(dataDir, { name, email, password }) {
  const passwordHash = await hashPassword(password)
  const seeded = await readJson(dataDir, 'users.json', [])
  return updateJson(dataDir, 'accounts.json', [], (accounts) => {
    const taken = [...seeded, ...accounts].some((u) => normalizeEmail(u.email) === email)
    if (taken) return { value: null }
    const user = { id: randomUUID(), name, email, passwordHash }
    return { next: [...accounts, user], value: user }
  })
}
