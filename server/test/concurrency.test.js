import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { findAttempt } from '../lib/attempts.js'
import { loginAs, makeDataDir, request, startApp } from './helpers.js'

let dataDir, server

beforeEach(async () => {
  dataDir = await makeDataDir()
  server = await startApp(createApp({ dataDir }))
})
afterEach(() => server.close())

test('parallel logins all get working tokens', async () => {
  const tokens = await Promise.all(Array.from({ length: 20 }, () => loginAs(server.url)))
  const results = await Promise.all(tokens.map((token) => request(server.url, '/api/test', { token })))
  assert.deepEqual(results.map((r) => r.status), Array(20).fill(200))
})

test('two first GET /api/test calls both succeed with one startedAt', async () => {
  const token = await loginAs(server.url)
  const [a, b] = await Promise.all([
    request(server.url, '/api/test', { token }),
    request(server.url, '/api/test', { token }),
  ])
  assert.equal(a.status, 200)
  assert.equal(b.status, 200)
  assert.equal(a.body.startedAt, b.body.startedAt)
})

test('two students starting at once both keep their attempts', async () => {
  const [t1, t2] = await Promise.all([loginAs(server.url), loginAs(server.url, 'diya@student.com')])
  await Promise.all([request(server.url, '/api/test', { token: t1 }), request(server.url, '/api/test', { token: t2 })])
  assert.ok(await findAttempt(dataDir, 'u1'))
  assert.ok(await findAttempt(dataDir, 'u2'))
})

test('save racing submit never 500s and never un-submits', async () => {
  const token = await loginAs(server.url)
  await request(server.url, '/api/test', { token })
  const [save, submit] = await Promise.all([
    request(server.url, '/api/attempt', { method: 'PUT', token, body: { answers: { q1: 1 }, marked: [] } }),
    request(server.url, '/api/submit', { method: 'POST', token, body: { answers: { q1: 1 } } }),
  ])
  assert.ok([200, 409].includes(save.status), `save ${save.status}`)
  assert.equal(submit.status, 200)
  const attempt = await findAttempt(dataDir, 'u1')
  assert.ok(attempt.submittedAt)
})
