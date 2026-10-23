import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createApp } from '../app.js'
import { GRACE_MS } from '../lib/attempts.js'
import { listScreenshots, MAX_SCREENSHOTS, saveScreenshot, screenshotPath } from '../lib/screens.js'
import { fakeClock, loginAs, makeDataDir, request, startApp } from './helpers.js'

// The smallest thing that passes as a JPEG: its start-of-image bytes.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

let dataDir, server, now, token

beforeEach(async () => {
  dataDir = await makeDataDir()
  now = fakeClock()
  server = await startApp(createApp({ dataDir, now }))
  token = await loginAs(server.url)
})
afterEach(() => server.close())

const getTest = () => request(server.url, '/api/test', { token })
const submit = () => request(server.url, '/api/submit', { method: 'POST', token, body: { answers: {} } })

async function sendScreen(body = JPEG, type = 'image/jpeg') {
  const res = await fetch(`${server.url}/api/screen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': type },
    body,
  })
  return res.status
}

test('a screenshot during the test is stored', async () => {
  await getTest()
  assert.equal(await sendScreen(), 201)
  assert.deepEqual(await listScreenshots(dataDir, 'u1'), [now()])
  assert.deepEqual(await readFile(screenshotPath(dataDir, 'u1', now())), JPEG)
})

test('only JPEGs are accepted', async () => {
  await getTest()
  assert.equal(await sendScreen(Buffer.from('hello'), 'image/jpeg'), 400)
  assert.equal(await sendScreen(JPEG, 'text/plain'), 400)
})

test('no screenshots before the test or after submitting', async () => {
  assert.equal(await sendScreen(), 404)
  await getTest()
  await submit()
  assert.equal(await sendScreen(), 409)
})

test('no screenshots once time is up', async () => {
  await getTest()
  now.advance(10 * 60_000 + GRACE_MS + 1)
  assert.equal(await sendScreen(), 410)
})

test('needs a login', async () => {
  token = null
  assert.equal(await sendScreen(), 401)
})

test('only the newest screenshots are kept', async () => {
  for (let at = 1; at <= MAX_SCREENSHOTS + 3; at++) await saveScreenshot(dataDir, 'u1', at, JPEG)
  const kept = await listScreenshots(dataDir, 'u1')
  assert.equal(kept.length, MAX_SCREENSHOTS)
  assert.equal(kept[0], 4)
})
