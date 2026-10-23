import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
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

const getTest = () => request(server.url, '/api/test', { token })
const submit = (answers) => request(server.url, '/api/submit', { method: 'POST', token, body: { answers } })
const retake = () => request(server.url, '/api/retake', { method: 'POST', token })
const getResult = () => request(server.url, '/api/result', { token })
const save = (answers) =>
  request(server.url, '/api/attempt', { method: 'PUT', token, body: { answers, marked: [] } })

test('retake after submitting starts a fresh attempt', async () => {
  await getTest()
  await submit({ q1: correct.q1 })
  const res = await retake()
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { ok: true })

  now.advance(60 * 60_000)
  const fresh = await getTest()
  assert.equal(fresh.body.status, 'in_progress')
  assert.deepEqual(fresh.body.answers, {})
  assert.deepEqual(fresh.body.marked, [])
  assert.equal(fresh.body.startedAt, now(), 'the new 10 minutes start when the test opens')
})

test('no result until the new attempt is submitted', async () => {
  await getTest()
  await submit({})
  await retake()
  assert.equal((await getResult()).status, 404)
})

test('cannot retake before submitting', async () => {
  assert.equal((await retake()).status, 404)
  await getTest()
  const res = await retake()
  assert.equal(res.status, 409)
  assert.equal(res.body.error, 'Submit your current attempt first')
})

test('saving or submitting is blocked until the new attempt opens', async () => {
  await getTest()
  await submit({})
  await retake()
  assert.equal((await save({ q1: 0 })).status, 404)
  assert.equal((await submit({ q1: 0 })).status, 404)
})

test('the result lists earlier scores, newest first', async () => {
  await getTest()
  await submit({ q1: correct.q1 })
  await retake()
  await getTest()
  await submit({ q1: correct.q1, q2: correct.q2 })
  await retake()
  await getTest()
  now.advance(60_000)
  await submit(correct)

  const res = await getResult()
  assert.equal(res.body.score, 10)
  assert.deepEqual(res.body.previous.map((r) => r.score), [2, 1])
  for (const r of res.body.previous) assert.deepEqual(Object.keys(r).sort(), ['score', 'submittedAt', 'total'])
})

test('a first attempt has no earlier scores', async () => {
  await getTest()
  await submit({})
  assert.deepEqual((await getResult()).body.previous, [])
})
