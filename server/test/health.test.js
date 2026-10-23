import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { makeDataDir, startApp } from './helpers.js'

test('GET /api/health returns ok', async () => {
  const server = await startApp(createApp({ dataDir: await makeDataDir() }))
  try {
    const res = await fetch(`${server.url}/api/health`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('access-control-allow-origin'), '*')
    assert.deepEqual(await res.json(), { ok: true })
  } finally {
    await server.close()
  }
})

test('OPTIONS /api/login returns 204', async () => {
  const server = await startApp(createApp({ dataDir: await makeDataDir() }))
  try {
    const res = await fetch(`${server.url}/api/login`, { method: 'OPTIONS' })
    assert.equal(res.status, 204)
    const allowed = res.headers.get('access-control-allow-headers')
    assert.match(allowed, /Authorization/)
    assert.match(allowed, /Content-Type/)
  } finally {
    await server.close()
  }
})
