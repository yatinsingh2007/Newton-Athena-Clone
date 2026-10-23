import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attemptLabel, awaySummary, formatAgo, screenState, sortStudents, STALE_SCREEN_MS } from './proctor.js'

const student = (status, lastScreenshotAt = null, name = 'A') => ({ name, attempt: { status }, lastScreenshotAt })

test('screen state', () => {
  const now = 1_000_000
  assert.equal(screenState(student('in_progress'), now), 'none')
  assert.equal(screenState(student('in_progress', now - 10_000), now), 'live')
  assert.equal(screenState(student('in_progress', now - STALE_SCREEN_MS - 1), now), 'stale')
  assert.equal(screenState(student('submitted', now - STALE_SCREEN_MS - 1), now), 'done')
})

test('away summary', () => {
  const attempt = { status: 'in_progress', away: [{ leftAt: 0, backAt: 4000 }, { leftAt: 10_000, backAt: null }] }
  assert.deepEqual(awaySummary(attempt, 12_000), { count: 2, totalMs: 6000, awayNow: true })
  assert.equal(awaySummary({ ...attempt, status: 'submitted' }, 12_000).awayNow, false)
  assert.deepEqual(awaySummary({ status: 'not_started' }, 0), { count: 0, totalMs: 0, awayNow: false })
})

test('attempt label', () => {
  assert.equal(attemptLabel({ status: 'submitted', score: 7, total: 10 }), 'Submitted · 7 / 10')
  assert.equal(attemptLabel({ status: 'in_progress' }), 'In test')
  assert.equal(attemptLabel({ status: 'not_started' }), 'Not started')
})

test('formatAgo', () => {
  assert.equal(formatAgo(4_000), '4s ago')
  assert.equal(formatAgo(-500), '0s ago')
  assert.equal(formatAgo(125_000), '2m ago')
  assert.equal(formatAgo(2 * 3_600_000), '2h ago')
})

test('students in the test come first', () => {
  const sorted = sortStudents([
    student('not_started', null, 'Zed'),
    student('submitted', null, 'Bea'),
    student('in_progress', null, 'Cal'),
    student('in_progress', null, 'Amy'),
  ])
  assert.deepEqual(sorted.map((s) => s.name), ['Amy', 'Cal', 'Bea', 'Zed'])
})
