import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { findAttempt, GRACE_MS } from '../lib/attempts.js'
import { fakeClock, loginAs, makeDataDir, request, startApp } from './helpers.js'

let dataDir, server, now, token

beforeEach(async () => {
  dataDir = await makeDataDir()
  now = fakeClock()
  server = await startApp(createApp({ dataDir, now }))
  token = await loginAs(server.url)
})
afterEach(() => server.close())

const startTest = () => request(server.url, '/api/test', { token })
const save = (body) => request(server.url, '/api/attempt', { method: 'PUT', token, body })

test('saves answers and marked', async () => {
  await startTest()
  const res = await save({ answers: { q1: 0, q2: 3 }, marked: ['q2'] })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { ok: true })
  const attempt = await findAttempt(dataDir, 'u1')
  assert.deepEqual(attempt.answers, { q1: 0, q2: 3 })
  assert.deepEqual(attempt.marked, ['q2'])
})

test('rejects invalid answers', async () => {
  await startTest()
  await save({ answers: { q1: 1 }, marked: [] })
  const cases = [
    [{ answers: { q99: 0 }, marked: [] }, 'Invalid answers'],
    [{ answers: { q1: 4 }, marked: [] }, 'Invalid answers'],
    [{ answers: { q1: -1 }, marked: [] }, 'Invalid answers'],
    [{ answers: { q1: 'a' }, marked: [] }, 'Invalid answers'],
    [{ answers: [], marked: [] }, 'Invalid answers'],
    [{ answers: {}, marked: 'q1' }, 'Invalid marked list'],
    [{ answers: {}, marked: ['q99'] }, 'Invalid marked list'],
  ]
  for (const [body, error] of cases) {
    const res = await save(body)
    assert.equal(res.status, 400, JSON.stringify(body))
    assert.equal(res.body.error, error)
  }
  const attempt = await findAttempt(dataDir, 'u1')
  assert.deepEqual(attempt.answers, { q1: 1 })
})

test('404 before test started', async () => {
  const res = await save({ answers: {}, marked: [] })
  assert.equal(res.status, 404)
})

test('410 after deadline plus grace', async () => {
  await startTest()
  now.advance(10 * 60_000 + GRACE_MS + 1)
  const res = await save({ answers: { q1: 0 }, marked: [] })
  assert.equal(res.status, 410)
  assert.equal(res.body.error, 'Time is up')
})

test('save within grace is accepted', async () => {
  await startTest()
  now.advance(10 * 60_000 + GRACE_MS)
  const res = await save({ answers: { q1: 0 }, marked: [] })
  assert.equal(res.status, 200)
})
