import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoSubmitDue, formatClock, remainingMs, SUBMIT_RETRY_MS } from './timer.js'

const startedAt = 1_000_000

test('full duration at start', () => {
  const ms = remainingMs({ startedAt, durationMinutes: 10, serverNow: startedAt, clientNowAtFetch: startedAt, clientNow: startedAt })
  assert.equal(ms, 600_000)
})

test('counts down as the client clock moves', () => {
  const ms = remainingMs({ startedAt, durationMinutes: 10, serverNow: startedAt, clientNowAtFetch: startedAt, clientNow: startedAt + 90_000 })
  assert.equal(ms, 510_000)
})

test('remainingMs corrects for clock skew', () => {
  const behind = startedAt - 5 * 60_000
  const ms = remainingMs({ startedAt, durationMinutes: 10, serverNow: startedAt, clientNowAtFetch: behind, clientNow: behind })
  assert.equal(ms, 600_000)
})

test('resuming uses time already spent on the server', () => {
  const serverNow = startedAt + 4 * 60_000
  const ms = remainingMs({ startedAt, durationMinutes: 10, serverNow, clientNowAtFetch: 50, clientNow: 50 })
  assert.equal(ms, 360_000)
})

test('never negative', () => {
  const ms = remainingMs({ startedAt, durationMinutes: 10, serverNow: startedAt + 3_600_000, clientNowAtFetch: 0, clientNow: 0 })
  assert.equal(ms, 0)
})

test('formatClock', () => {
  assert.equal(formatClock(600_000), '10:00')
  assert.equal(formatClock(59_001), '01:00')
  assert.equal(formatClock(59_000), '00:59')
  assert.equal(formatClock(1), '00:01')
  assert.equal(formatClock(0), '00:00')
})

test('autoSubmitDue only when time is up and the retry wait has passed', () => {
  assert.equal(autoSubmitDue({ remaining: 1000, now: 10, retryAt: 0 }), false)
  assert.equal(autoSubmitDue({ remaining: 0, now: 10, retryAt: 0 }), true)
  assert.equal(autoSubmitDue({ remaining: 0, now: 10, retryAt: 5000 }), false)
  assert.equal(autoSubmitDue({ remaining: 0, now: 5000, retryAt: 5000 }), true)
})

test('SUBMIT_RETRY_MS is 5 seconds', () => {
  assert.equal(SUBMIT_RETRY_MS, 5000)
})
