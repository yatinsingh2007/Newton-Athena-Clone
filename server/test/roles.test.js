import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { makeDataDir, request, startApp } from './helpers.js'

let server

beforeEach(async () => {
  server = await startApp(createApp({ dataDir: await makeDataDir() }))
})
afterEach(() => server.close())

const loginProctor = () =>
  request(server.url, '/api/login', {
    method: 'POST',
    body: { email: 'proctor@athena.com', password: 'proctor123' },
  })

test('a proctor logs in with the proctor role', async () => {
  const res = await loginProctor()
  assert.equal(res.status, 200)
  assert.equal(res.body.user.role, 'proctor')
})

test('a proctor cannot take the test', async () => {
  const { token } = (await loginProctor()).body
  for (const path of ['/api/test', '/api/exam', '/api/result']) {
    assert.equal((await request(server.url, path, { token })).status, 403, path)
  }
})
