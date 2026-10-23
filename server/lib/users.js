import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { readJson, updateJson } from './store.js'

const scryptAsync = promisify(scrypt)

// users.json holds every student: the demo ones and everyone who signed up.
export function allUsers(dataDir) {
  return readJson(dataDir, 'users.json', [])
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
  return updateJson(dataDir, 'users.json', [], (users) => {
    if (users.some((u) => normalizeEmail(u.email) === email)) return { value: null }
    const user = { id: randomUUID(), name, email, passwordHash }
    return { next: [...users, user], value: user }
  })
}
