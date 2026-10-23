import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { findAttempt, GRACE_MS, MAX_AWAY, recordAway } from '../lib/attempts.js'
import { fakeClock, loginAs, makeDataDir, request, startApp } from './helpers.js'

let dataDir, server, now, token

beforeEach(async () => {
  dataDir = await makeDataDir()
  now = fakeClock()
  server = await startApp(createApp({ dataDir, now }))
  token = await loginAs(server.url)
})
afterEach(() => server.close())

const getTest = () => request(server.url, '/api/test', { token })
const away = (value) => request(server.url, '/api/away', { method: 'POST', token, body: { away: value } })

test('leaving and coming back is recorded with the server clock', async () => {
  await getTest()
  const start = now()
  now.advance(60_000)
  assert.equal((await away(true)).status, 200)
  now.advance(8_000)
  assert.equal((await away(false)).status, 200)
  const attempt = await findAttempt(dataDir, 'u1')
  assert.deepEqual(attempt.away, [{ leftAt: start + 60_000, backAt: start + 68_000 }])
})

test('repeated reports of the same state count once', async () => {
  await getTest()
  await away(true)
  await away(true)
  await away(false)
  await away(false)
  assert.equal((await findAttempt(dataDir, 'u1')).away.length, 1)
})

test('needs { away: boolean }', async () => {
  await getTest()
  assert.equal((await request(server.url, '/api/away', { method: 'POST', token, body: {} })).status, 400)
})

test('only while the test is in progress', async () => {
  assert.equal((await away(true)).status, 404)
  await getTest()
  now.advance(10 * 60_000 + GRACE_MS + 1)
  assert.equal((await away(true)).status, 410)
})

test('a retake starts with no time away', async () => {
  await getTest()
  await away(true)
  await request(server.url, '/api/submit', { method: 'POST', token, body: { answers: {} } })
  await request(server.url, '/api/retake', { method: 'POST', token })
  await getTest()
  assert.deepEqual((await findAttempt(dataDir, 'u1')).away, [])
})

test('only the newest events are kept', () => {
  let attempt = { away: [] }
  for (let i = 0; i < MAX_AWAY + 5; i++) {
    attempt = recordAway(attempt, true, i * 10)
    attempt = recordAway(attempt, false, i * 10 + 5)
  }
  assert.equal(attempt.away.length, MAX_AWAY)
  assert.equal(attempt.away[0].leftAt, 50)
})

test('attempts saved before this feature work too', () => {
  assert.deepEqual(recordAway({}, true, 7).away, [{ leftAt: 7, backAt: null }])
})
