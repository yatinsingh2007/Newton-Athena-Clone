import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readJson, writeJson } from '../lib/store.js'

// Real questions, but a fixed set of users: the live users.json grows with every signup.
const SEED_FILES = {
  'questions.json': path.join(import.meta.dirname, '..', 'data', 'questions.json'),
  'users.json': path.join(import.meta.dirname, 'fixtures', 'users.json'),
}

// A fresh temp data folder for one test. attempts.json and sessions.json start out missing.
// The exam window is left out, so each student's time starts when they open the test;
// pass `startsAt` (ms) to open the test to everyone at that time instead.
export async function makeDataDir(from = SEED_FILES, { startsAt } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'athena-data-'))
  for (const [file, source] of Object.entries(from)) await copyFile(source, path.join(dir, file))
  const test = await readJson(dir, 'questions.json', null)
  if (test) {
    delete test.startsAt
    if (startsAt !== undefined) test.startsAt = new Date(startsAt).toISOString()
    await writeJson(dir, 'questions.json', test)
  }
  return dir
}

export function startApp(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      })
    })
  })
}

export async function request(baseUrl, urlPath, { method = 'GET', token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

export async function loginAs(baseUrl, email = 'aarav@student.com') {
  const res = await request(baseUrl, '/api/login', {
    method: 'POST',
    body: { email, password: 'pass123' },
  })
  return res.body.token
}

export function fakeClock(start = Date.UTC(2026, 9, 23, 10, 0, 0)) {
  let current = start
  const now = () => current
  now.advance = (ms) => { current += ms }
  return now
}
