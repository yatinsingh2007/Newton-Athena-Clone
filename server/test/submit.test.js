import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { GRACE_MS } from '../lib/attempts.js'
import { readJson } from '../lib/store.js'
import { fakeClock, loginAs, makeDataDir, request, startApp } from './helpers.js'

let dataDir, server, now, token, correct

beforeEach(async () => {
  dataDir = await makeDataDir()
  now = fakeClock()
  server = await startApp(createApp({ dataDir, now }))
  token = await loginAs(server.url)
  const { questions } = await readJson(dataDir, 'questions.json')
  correct = Object.fromEntries(questions.map((q) => [q.id, q.answerIndex]))
})
afterEach(() => server.close())

const startTest = () => request(server.url, '/api/test', { token })
const save = (answers) =>
  request(server.url, '/api/attempt', { method: 'PUT', token, body: { answers, marked: [] } })
const submit = (body) => request(server.url, '/api/submit', { method: 'POST', token, body })
const getResult = () => request(server.url, '/api/result', { token })
const TEN_MIN = 10 * 60_000

test('submit grades body answers', async () => {
  await startTest()
  now.advance(60_000)
  const res = await submit({ answers: { q1: correct.q1, q2: correct.q2 } })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { score: 2, total: 10, submittedAt: now() })
})

test('submit within grace is accepted', async () => {
  await startTest()
  now.advance(TEN_MIN + GRACE_MS)
  const res = await submit({ answers: correct })
  assert.equal(res.status, 200)
  assert.equal(res.body.score, 10)
})

test('submit after grace grades saved answers only', async () => {
  await startTest()
  await save({ q1: correct.q1 })
  now.advance(TEN_MIN + GRACE_MS + 1)
  const res = await submit({ answers: correct })
  assert.equal(res.status, 200)
  assert.equal(res.body.score, 1)
})

test('submit validates body answers', async () => {
  await startTest()
  const res = await submit({ answers: { q1: 9 } })
  assert.equal(res.status, 400)
})

test('submit before starting is 404', async () => {
  const res = await submit({ answers: {} })
  assert.equal(res.status, 404)
})

test('second submit is 409', async () => {
  await startTest()
  await submit({ answers: correct })
  const res = await submit({ answers: {} })
  assert.equal(res.status, 409)
  assert.equal(res.body.error, 'Already submitted')
})

test('saving progress after submit is 409', async () => {
  await startTest()
  await submit({ answers: {} })
  const res = await save({ q1: 0 })
  assert.equal(res.status, 409)
})

test('result is 404 before submit and 200 after', async () => {
  await startTest()
  assert.equal((await getResult()).status, 404)
  await submit({ answers: correct })
  const res = await getResult()
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { score: 10, total: 10, submittedAt: now() })
})

test('GET /api/test after submit returns the result', async () => {
  await startTest()
  await submit({ answers: correct })
  const res = await startTest()
  assert.deepEqual(res.body, { status: 'submitted', result: { score: 10, total: 10, submittedAt: now() } })
})

test('GET /api/test after expiry auto-submits saved answers', async () => {
  await startTest()
  await save({ q1: correct.q1, q2: correct.q2, q3: (correct.q3 + 1) % 4 })
  now.advance(TEN_MIN + GRACE_MS + 1)
  const res = await startTest()
  assert.equal(res.body.status, 'submitted')
  assert.equal(res.body.result.score, 2)
  assert.equal((await getResult()).status, 200)
})

test('submit response has no answerIndex', async () => {
  await startTest()
  const res = await submit({ answers: correct })
  assert.ok(!JSON.stringify(res.body).includes('answerIndex'))
})
