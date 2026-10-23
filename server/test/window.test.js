import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { GRACE_MS } from '../lib/attempts.js'
import { readJson } from '../lib/store.js'
import { fakeClock, loginAs, makeDataDir, request, startApp } from './helpers.js'

// The fake clock starts at 10:00; the exam is open to everyone from 10:05 to 10:15.
const clock = fakeClock()
const startsAt = clock() + 5 * 60_000
const endsAt = startsAt + 10 * 60_000

let dataDir, server, now, token

beforeEach(async () => {
  dataDir = await makeDataDir(undefined, { startsAt })
  now = fakeClock()
  server = await startApp(createApp({ dataDir, now }))
  token = await loginAs(server.url)
})
afterEach(() => server.close())

const getExam = () => request(server.url, '/api/exam', { token })
const getTest = () => request(server.url, '/api/test', { token })
const save = (answers) =>
  request(server.url, '/api/attempt', { method: 'PUT', token, body: { answers, marked: [] } })
const submit = (answers) => request(server.url, '/api/submit', { method: 'POST', token, body: { answers } })
const retake = () => request(server.url, '/api/retake', { method: 'POST', token })
const getResult = () => request(server.url, '/api/result', { token })

test('exam info gives the window and the server clock', async () => {
  const res = await getExam()
  assert.equal(res.status, 200)
  assert.equal(res.body.startsAt, startsAt)
  assert.equal(res.body.endsAt, endsAt)
  assert.equal(res.body.now, now())
  assert.equal(res.body.durationMinutes, 10)
  assert.ok(res.body.title)
})

test('exam info needs a login', async () => {
  assert.equal((await request(server.url, '/api/exam')).status, 401)
})

test('without a window, exam info has no start or end', async () => {
  const dir = await makeDataDir()
  const other = await startApp(createApp({ dataDir: dir, now }))
  try {
    const res = await request(other.url, '/api/exam', { token: await loginAs(other.url) })
    assert.equal(res.body.startsAt, null)
    assert.equal(res.body.endsAt, null)
  } finally {
    await other.close()
  }
})

test('before the window opens the test is not available', async () => {
  const res = await getTest()
  assert.equal(res.body.status, 'not_started')
  assert.equal(res.body.startsAt, startsAt)
  assert.equal(res.body.questions, undefined)
  assert.deepEqual(await readJson(dataDir, 'attempts.json', []), [], 'no attempt is started early')
})

test('everyone ends at the end of the window, however late they start', async () => {
  now.advance(5 * 60_000 + 4 * 60_000)
  const res = await getTest()
  assert.equal(res.body.status, 'in_progress')
  assert.equal(res.body.endsAt, endsAt)
  assert.equal(res.body.now, startsAt + 4 * 60_000)
})

test('saving stops once the window is over', async () => {
  now.advance(5 * 60_000)
  await getTest()
  assert.equal((await save({ q1: 0 })).status, 200)
  now.advance(10 * 60_000 + GRACE_MS + 1)
  assert.equal((await save({ q1: 1 })).status, 410)
})

test('an unfinished attempt is graded when the window closes', async () => {
  now.advance(5 * 60_000)
  await getTest()
  await save({ q1: 0 })
  now.advance(10 * 60_000 + GRACE_MS + 1)
  const res = await getTest()
  assert.equal(res.body.status, 'submitted')
  assert.equal((await getResult()).status, 200)
})

test('a student who never started sees the test as closed', async () => {
  now.advance(15 * 60_000 + GRACE_MS + 1)
  const res = await getTest()
  assert.equal(res.body.status, 'closed')
  assert.equal(res.body.questions, undefined)
})

test('retake works inside the window but not after it', async () => {
  now.advance(5 * 60_000)
  await getTest()
  await submit({})
  assert.equal((await retake()).status, 200)
  const again = await getTest()
  assert.equal(again.body.endsAt, endsAt, 'the retake still ends with the window')
  await submit({})

  now.advance(10 * 60_000 + GRACE_MS + 1)
  assert.equal((await retake()).status, 410)
})

test('exam info tells the student whether they have done the test', async () => {
  assert.deepEqual((await getExam()).body.attempt, { status: 'not_started', result: null })

  now.advance(5 * 60_000)
  await getTest()
  assert.equal((await getExam()).body.attempt.status, 'in_progress')

  await submit({})
  const { attempt } = (await getExam()).body
  assert.equal(attempt.status, 'submitted')
  assert.equal(attempt.result.total, 10)
})

test('exam info grades an attempt whose time ran out', async () => {
  now.advance(5 * 60_000)
  await getTest()
  now.advance(10 * 60_000 + GRACE_MS + 1)
  assert.equal((await getExam()).body.attempt.status, 'submitted')
})
