import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStoredSession, SESSION_KEY } from './session.js'

const user = { id: 'u1', name: 'Asha', email: 'asha@student.com' }
const stored = (data) => JSON.stringify(data)

test('restores a test in progress', () => {
  assert.deepEqual(parseStoredSession(stored({ token: 't1', user, screen: 'test', result: null })), {
    session: { token: 't1', user },
    screen: 'test',
    result: null,
  })
})

test('restores the result screen with its result', () => {
  const result = { score: 7, total: 10, submittedAt: 1, previous: [] }
  assert.deepEqual(parseStoredSession(stored({ token: 't1', user, screen: 'result', result })).result, result)
})

test('ignores a result screen without a result', () => {
  assert.equal(parseStoredSession(stored({ token: 't1', user, screen: 'result' })), null)
})

test('ignores missing, broken or incomplete data', () => {
  assert.equal(parseStoredSession(null), null)
  assert.equal(parseStoredSession('{not json'), null)
  assert.equal(parseStoredSession(stored({ user, screen: 'test' })), null)
  assert.equal(parseStoredSession(stored({ token: 't1', screen: 'test' })), null)
  assert.equal(parseStoredSession(stored({ token: 't1', user, screen: 'login' })), null)
})

test('storage key is athena-session', () => {
  assert.equal(SESSION_KEY, 'athena-session')
})
