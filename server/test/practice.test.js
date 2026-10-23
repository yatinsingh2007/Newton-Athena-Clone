import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { GRACE_MS } from '../lib/attempts.js'
import { listScreenshots } from '../lib/screens.js'
import { fakeClock, loginAs, makeDataDir, request, startApp } from './helpers.js'

// The exam opens at 10:05 (the fake clock starts at 10:00); practice has no window.
const startsAt = fakeClock()() + 5 * 60_000
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

let server, now, token, dataDir

beforeEach(async () => {
  dataDir = await makeDataDir(undefined, { startsAt })
  now = fakeClock()
  server = await startApp(createApp({ dataDir, now }))
  token = await loginAs(server.url)
})
afterEach(() => server.close())

const practice = (path, options = {}) => request(server.url, `/api/tests/practice${path}`, { token, ...options })

test('lists both tests with where the student stands', async () => {
  const res = await request(server.url, '/api/tests', { token })
  assert.equal(res.status, 200)
  assert.equal(res.body.now, now())
  assert.deepEqual(res.body.tests.map((t) => t.id), ['exam', 'practice'])
  const [exam, prac] = res.body.tests
  assert.equal(exam.startsAt, startsAt)
  assert.equal(prac.startsAt, null)
  assert.ok(prac.title)
  assert.deepEqual(prac.attempt, { status: 'not_started', result: null })
})

test('practice can be started any time, even before the exam opens', async () => {
  const res = await practice('/test')
  assert.equal(res.body.status, 'in_progress')
  assert.equal(res.body.endsAt, now() + 10 * 60_000)
  assert.equal(res.body.questions.length, 10)
  assert.equal((await request(server.url, '/api/test', { token })).body.status, 'not_started', 'the exam still waits')
})

test('a refresh keeps the original start and the time left', async () => {
  const first = await practice('/test')
  now.advance(4 * 60_000)
  const again = await practice('/test')
  assert.equal(again.body.startedAt, first.body.startedAt)
  assert.equal(again.body.endsAt - again.body.now, 6 * 60_000)
})

test('practice and exam attempts are separate', async () => {
  await practice('/test')
  await practice('/attempt', { method: 'PUT', body: { answers: { q1: 1 }, marked: [] } })
  const submitted = await practice('/submit', { method: 'POST', body: { answers: { q1: 1 } } })
  assert.equal(submitted.body.score, 1)
  const tests = (await request(server.url, '/api/tests', { token })).body.tests
  assert.equal(tests[0].attempt.status, 'not_started')
  assert.equal(tests[1].attempt.status, 'submitted')
  assert.equal(tests[1].attempt.result.score, 1)
})

test('time runs out after 10 minutes and the attempt is graded', async () => {
  await practice('/test')
  now.advance(10 * 60_000 + GRACE_MS + 1)
  assert.equal((await practice('/attempt', { method: 'PUT', body: { answers: {}, marked: [] } })).status, 410)
  assert.equal((await practice('/result')).status, 200)
})

test('practice can be retaken any time', async () => {
  await practice('/test')
  await practice('/submit', { method: 'POST', body: { answers: {} } })
  now.advance(24 * 60 * 60_000)
  assert.equal((await practice('/retake', { method: 'POST' })).status, 200)
  assert.equal((await practice('/test')).body.status, 'in_progress')
})

test('screenshots and time away are kept for the practice test', async () => {
  await practice('/test')
  const res = await fetch(`${server.url}/api/tests/practice/screen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
    body: JPEG,
  })
  assert.equal(res.status, 201)
  assert.deepEqual(await listScreenshots(dataDir, 'practice', 'u1'), [now()])
  assert.deepEqual(await listScreenshots(dataDir, 'exam', 'u1'), [])
  assert.equal((await practice('/away', { method: 'POST', body: { away: true } })).status, 200)
})

test('the proctor can pick the practice test', async () => {
  await practice('/test')
  const login = await request(server.url, '/api/login', {
    method: 'POST',
    body: { email: 'proctor@athena.com', password: 'proctor123' },
  })
  const proctor = login.body.token
  const tests = await request(server.url, '/api/proctor/tests', { token: proctor })
  assert.deepEqual(tests.body.tests.map((t) => t.id), ['exam', 'practice'])
  const students = await request(server.url, '/api/proctor/students?test=practice', { token: proctor })
  assert.equal(students.body.exam.startsAt, null)
  assert.equal(students.body.students.find((s) => s.id === 'u1').attempt.status, 'in_progress')
  const exam = await request(server.url, '/api/proctor/students', { token: proctor })
  assert.equal(exam.body.students.find((s) => s.id === 'u1').attempt.status, 'not_started')
  assert.equal((await request(server.url, '/api/proctor/students?test=nope', { token: proctor })).status, 404)
})

test('students cannot list the proctor tests, nor proctors the student ones', async () => {
  assert.equal((await request(server.url, '/api/proctor/tests', { token })).status, 403)
  const login = await request(server.url, '/api/login', {
    method: 'POST',
    body: { email: 'proctor@athena.com', password: 'proctor123' },
  })
  assert.equal((await request(server.url, '/api/tests', { token: login.body.token })).status, 403)
})
