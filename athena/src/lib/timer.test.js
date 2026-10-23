import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoSubmitDue, examPhase, formatClock, remainingMs, serverTime, SUBMIT_RETRY_MS } from './timer.js'

const startedAt = 1_000_000
const endsAt = startedAt + 600_000

test('full duration at start', () => {
  const ms = remainingMs({ endsAt, serverNow: startedAt, clientNowAtFetch: startedAt, clientNow: startedAt })
  assert.equal(ms, 600_000)
})

test('counts down as the client clock moves', () => {
  const ms = remainingMs({ endsAt, serverNow: startedAt, clientNowAtFetch: startedAt, clientNow: startedAt + 90_000 })
  assert.equal(ms, 510_000)
})

test('remainingMs corrects for clock skew', () => {
  const behind = startedAt - 5 * 60_000
  const ms = remainingMs({ endsAt, serverNow: startedAt, clientNowAtFetch: behind, clientNow: behind })
  assert.equal(ms, 600_000)
})

test('resuming uses time already spent on the server', () => {
  const serverNow = startedAt + 4 * 60_000
  const ms = remainingMs({ endsAt, serverNow, clientNowAtFetch: 50, clientNow: 50 })
  assert.equal(ms, 360_000)
})

test('never negative', () => {
  const ms = remainingMs({ endsAt, serverNow: startedAt + 3_600_000, clientNowAtFetch: 0, clientNow: 0 })
  assert.equal(ms, 0)
})

test('serverTime moves with the client clock from the last sync', () => {
  assert.equal(serverTime({ serverNow: 5000, clientNowAtFetch: 100, clientNow: 1100 }), 6000)
})

test('examPhase follows the window', () => {
  const window = { startsAt: 1000, endsAt: 2000 }
  assert.equal(examPhase(window, 999), 'upcoming')
  assert.equal(examPhase(window, 1000), 'open')
  assert.equal(examPhase(window, 1999), 'open')
  assert.equal(examPhase(window, 2000), 'closed')
  assert.equal(examPhase({ startsAt: null, endsAt: null }, 5), 'anytime')
})

test('formatClock', () => {
  assert.equal(formatClock(600_000), '10:00')
  assert.equal(formatClock(59_001), '01:00')
  assert.equal(formatClock(59_000), '00:59')
  assert.equal(formatClock(1), '00:01')
  assert.equal(formatClock(0), '00:00')
  assert.equal(formatClock(3_600_000), '1:00:00')
  assert.equal(formatClock(2 * 3_600_000 + 5 * 60_000 + 9_000), '2:05:09')
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
