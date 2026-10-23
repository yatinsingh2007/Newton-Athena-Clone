import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDuration, isAway, totalAwayMs } from './away.js'

const doc = (hidden, focused) => ({ hidden, hasFocus: () => focused })

test('away when hidden or not focused', () => {
  assert.equal(isAway(doc(false, true)), false)
  assert.equal(isAway(doc(false, false)), true)
  assert.equal(isAway(doc(true, true)), true)
})

test('formatDuration', () => {
  assert.equal(formatDuration(200), '1 second')
  assert.equal(formatDuration(8_000), '8 seconds')
  assert.equal(formatDuration(120_000), '2 min')
  assert.equal(formatDuration(125_000), '2 min 5 s')
})

test('totalAwayMs counts an open event up to now', () => {
  const events = [{ leftAt: 100, backAt: 600 }, { leftAt: 1000, backAt: null }]
  assert.equal(totalAwayMs(events, 1500), 1000)
  assert.equal(totalAwayMs([], 5), 0)
})
