import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { readJson } from '../lib/store.js'
import { makeDataDir, request, startApp } from './helpers.js'

let dataDir, server

beforeEach(async () => {
  dataDir = await makeDataDir()
  server = await startApp(createApp({ dataDir }))
})
afterEach(() => server.close())

const login = (body) => request(server.url, '/api/login', { method: 'POST', body })

test('valid login returns token and user without password', async () => {
  const res = await login({ email: 'aarav@student.com', password: 'pass123' })
  assert.equal(res.status, 200)
  assert.equal(typeof res.body.token, 'string')
  assert.deepEqual(res.body.user, { id: 'u1', name: 'Aarav Sharma', email: 'aarav@student.com' })
})

test('email is case-insensitive', async () => {
  const res = await login({ email: '  Aarav@Student.com ', password: 'pass123' })
  assert.equal(res.status, 200)
})

test('wrong password is 401', async () => {
  const res = await login({ email: 'aarav@student.com', password: 'nope' })
  assert.equal(res.status, 401)
  assert.equal(res.body.error, 'Invalid email or password')
})

test('missing fields is 400', async () => {
  const res = await login({ email: 'aarav@student.com' })
  assert.equal(res.status, 400)
  assert.equal(res.body.error, 'Email and password are required')
})

test('token is persisted in sessions.json', async () => {
  const res = await login({ email: 'diya@student.com', password: 'pass123' })
  const sessions = await readJson(dataDir, 'sessions.json', {})
  assert.equal(sessions[res.body.token], 'u2')
})
