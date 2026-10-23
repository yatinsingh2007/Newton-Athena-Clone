import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createApi } from './api.js'

function fakeFetch(routes) {
  const calls = []
  const impl = async (url, init = {}) => {
    calls.push({ url, ...init })
    const key = `${init.method ?? 'GET'} ${new URL(url).pathname}`
    const [status, body] = routes[key] ?? [404, { error: 'Not found' }]
    return new Response(JSON.stringify(body), { status })
  }
  return { impl, calls }
}

test('login sends JSON body and returns data', async () => {
  const { impl, calls } = fakeFetch({
    'POST /api/login': [200, { token: 't1', user: { id: 'u1' } }],
  })
  const api = createApi('http://x', impl)
  const data = await api.login('a@b.com', 'pw')
  assert.deepEqual(data, { token: 't1', user: { id: 'u1' } })
  assert.equal(calls[0].headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[0].body), { email: 'a@b.com', password: 'pw' })
})

test('adds bearer token', async () => {
  const { impl, calls } = fakeFetch({ 'GET /api/test': [200, { status: 'in_progress' }] })
  await createApi('http://x', impl).getTest('tok')
  assert.equal(calls[0].headers.Authorization, 'Bearer tok')
})

test('saveAttempt PUTs answers and marked', async () => {
  const { impl, calls } = fakeFetch({ 'PUT /api/attempt': [200, { ok: true }] })
  await createApi('http://x', impl).saveAttempt('tok', { answers: { q1: 1 }, marked: ['q2'] })
  assert.equal(calls[0].method, 'PUT')
  assert.deepEqual(JSON.parse(calls[0].body), { answers: { q1: 1 }, marked: ['q2'] })
})

test('non-2xx throws ApiError with server message', async () => {
  const { impl } = fakeFetch({ 'POST /api/login': [401, { error: 'Invalid email or password' }] })
  await assert.rejects(createApi('http://x', impl).login('a', 'b'), (err) => {
    assert.ok(err instanceof ApiError)
    assert.equal(err.status, 401)
    assert.equal(err.message, 'Invalid email or password')
    return true
  })
})

test('network failure throws ApiError with status 0', async () => {
  const impl = async () => { throw new TypeError('fetch failed') }
  await assert.rejects(createApi('http://x', impl).login('a', 'b'), (err) => {
    assert.ok(err instanceof ApiError)
    assert.equal(err.status, 0)
    assert.equal(err.message, 'Cannot reach the exam server. Is it running?')
    return true
  })
})

test('409 on submit resolves to saved result', async () => {
  const { impl } = fakeFetch({
    'POST /api/submit': [409, { error: 'Already submitted' }],
    'GET /api/result': [200, { score: 7, total: 10, submittedAt: 1 }],
  })
  const result = await createApi('http://x', impl).submit('tok', { q1: 0 })
  assert.deepEqual(result, { score: 7, total: 10, submittedAt: 1 })
})
