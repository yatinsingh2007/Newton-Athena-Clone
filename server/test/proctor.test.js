import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { saveScreenshot } from '../lib/screens.js'
import { fakeClock, loginAs, makeDataDir, request, startApp } from './helpers.js'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

let dataDir, server, now, proctor

beforeEach(async () => {
  dataDir = await makeDataDir()
  now = fakeClock()
  server = await startApp(createApp({ dataDir, now }))
  const res = await request(server.url, '/api/login', {
    method: 'POST',
    body: { email: 'proctor@athena.com', password: 'proctor123' },
  })
  proctor = res.body.token
})
afterEach(() => server.close())

const asProctor = (path) => request(server.url, `/api/proctor${path}`, { token: proctor })

test('lists every student with their progress, but not proctors', async () => {
  const student = await loginAs(server.url)
  await request(server.url, '/api/test', { token: student })
  await saveScreenshot(dataDir, 'u1', 1234, JPEG)

  const res = await asProctor('/students')
  assert.equal(res.status, 200)
  assert.equal(res.body.exam.now, now())
  assert.deepEqual(res.body.students.map((s) => s.id), ['u1', 'u2', 'u3'])
  const [aarav, diya] = res.body.students
  assert.equal(aarav.attempt.status, 'in_progress')
  assert.equal(aarav.attempt.startedAt, now())
  assert.equal(aarav.lastScreenshotAt, 1234)
  assert.deepEqual(diya.attempt, { status: 'not_started' })
  assert.equal(diya.lastScreenshotAt, null)
})

test("lists and serves a student's screenshots", async () => {
  await saveScreenshot(dataDir, 'u1', 1000, JPEG)
  await saveScreenshot(dataDir, 'u1', 2000, JPEG)
  assert.deepEqual((await asProctor('/students/u1/screens')).body.screenshots, [1000, 2000])

  const res = await fetch(`${server.url}/api/proctor/students/u1/screens/2000`, {
    headers: { Authorization: `Bearer ${proctor}` },
  })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'image/jpeg')
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), JPEG)
})

test('unknown students and screenshots are 404', async () => {
  assert.equal((await asProctor('/students/nobody/screens')).status, 404)
  assert.equal((await asProctor('/students/p1/screens')).status, 404, 'a proctor is not a student')
  assert.equal((await asProctor('/students/u1/screens/999')).status, 404)
  assert.equal((await asProctor('/students/u1/screens/..%2F..%2Fusers')).status, 404)
})

test('students cannot use the proctor routes', async () => {
  const student = await loginAs(server.url)
  const res = await request(server.url, '/api/proctor/students', { token: student })
  assert.equal(res.status, 403)
})

test('a student can still take the test with the proctor routes mounted first', async () => {
  const student = await loginAs(server.url)
  assert.equal((await request(server.url, '/api/test', { token: student })).status, 200)
})
