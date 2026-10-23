import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { readJson } from '../lib/store.js'
import { makeDataDir, request, startApp } from './helpers.js'

let dataDir, server

beforeEach(async () => {
  dataDir = await makeDataDir()
  server = await startApp(createApp({ dataDir }))
})
afterEach(() => server.close())

const signup = (body) => request(server.url, '/api/signup', { method: 'POST', body })
const login = (email, password) =>
  request(server.url, '/api/login', { method: 'POST', body: { email, password } })
const riya = { name: 'Riya Mehta', email: 'riya@student.com', password: 'secret1' }

test('signup creates an account and logs in', async () => {
  const res = await signup(riya)
  assert.equal(res.status, 201)
  assert.equal(typeof res.body.token, 'string')
  assert.equal(res.body.user.name, 'Riya Mehta')
  assert.equal(res.body.user.email, 'riya@student.com')
  assert.ok(res.body.user.id)
  assert.equal(res.body.user.password, undefined)
  const test = await request(server.url, '/api/test', { token: res.body.token })
  assert.equal(test.status, 200)
})

test('the new account can log in later', async () => {
  await signup(riya)
  assert.equal((await login('RIYA@student.com', 'secret1')).status, 200)
  assert.equal((await login('riya@student.com', 'wrong12')).status, 401)
})

test('the account is saved in users.json alongside the demo students', async () => {
  await signup(riya)
  const users = await readJson(dataDir, 'users.json', [])
  assert.equal(users.length, 4)
  assert.equal(users.at(-1).email, 'riya@student.com')
})

test('the password is stored hashed, never as plain text', async () => {
  await signup(riya)
  const saved = (await readJson(dataDir, 'users.json', [])).at(-1)
  assert.ok(saved.passwordHash)
  assert.equal(saved.password, undefined)
  assert.ok(!JSON.stringify(saved).includes('secret1'))
})

test('email and name are trimmed and email lowercased', async () => {
  const res = await signup({ name: '  Riya Mehta ', email: ' Riya@Student.COM ', password: 'secret1' })
  assert.equal(res.body.user.name, 'Riya Mehta')
  assert.equal(res.body.user.email, 'riya@student.com')
})

test('an email already registered is rejected', async () => {
  const seeded = await signup({ name: 'X', email: 'Aarav@student.com', password: 'secret1' })
  assert.equal(seeded.status, 409)
  assert.equal(seeded.body.error, 'An account with this email already exists')
  await signup(riya)
  assert.equal((await signup(riya)).status, 409)
})

test('invalid input is 400', async () => {
  const cases = [
    [{ ...riya, name: ' ' }, 'Name is required'],
    [{ ...riya, email: 'not-an-email' }, 'Enter a valid email'],
    [{ ...riya, password: '12345' }, 'Password must be at least 6 characters'],
    [{}, 'Name is required'],
  ]
  for (const [body, error] of cases) {
    const res = await signup(body)
    assert.equal(res.status, 400, JSON.stringify(body))
    assert.equal(res.body.error, error)
  }
})

test('parallel signups with the same email create one account', async () => {
  const results = await Promise.all([signup(riya), signup(riya), signup(riya)])
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409])
  const users = await readJson(dataDir, 'users.json', [])
  assert.equal(users.filter((u) => u.email === 'riya@student.com').length, 1)
})
