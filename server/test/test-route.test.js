import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { saveAttempt } from '../lib/attempts.js'
import { fakeClock, loginAs, makeDataDir, request, startApp } from './helpers.js'

let dataDir, server, now, token

beforeEach(async () => {
  dataDir = await makeDataDir()
  now = fakeClock()
  server = await startApp(createApp({ dataDir, now }))
  token = await loginAs(server.url)
})
afterEach(() => server.close())

const getTest = (t = token) => request(server.url, '/api/test', { token: t })

test('401 without token', async () => {
  const res = await getTest(null)
  assert.equal(res.status, 401)
})

test('questions never include answerIndex', async () => {
  const res = await getTest()
  assert.equal(res.status, 200)
  assert.equal(res.body.questions.length, 10)
  for (const q of res.body.questions) {
    assert.deepEqual(Object.keys(q).sort(), ['id', 'options', 'text'])
  }
})

test('first call sets startedAt to now()', async () => {
  const res = await getTest()
  assert.equal(res.body.status, 'in_progress')
  assert.equal(res.body.startedAt, now())
  assert.equal(res.body.now, now())
  assert.equal(res.body.durationMinutes, 10)
  assert.ok(res.body.title)
})

test('second call keeps the original startedAt', async () => {
  const first = await getTest()
  now.advance(3 * 60_000)
  const second = await getTest()
  assert.equal(second.body.startedAt, first.body.startedAt)
  assert.equal(second.body.now, first.body.startedAt + 3 * 60_000)
})

test('returns saved answers and marked', async () => {
  const first = await getTest()
  await saveAttempt(dataDir, {
    userId: 'u1', startedAt: first.body.startedAt, answers: { q1: 2 }, marked: ['q3'],
    submittedAt: null, score: null, total: null,
  })
  const res = await getTest()
  assert.deepEqual(res.body.answers, { q1: 2 })
  assert.deepEqual(res.body.marked, ['q3'])
})
