import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapshotSize } from './snapshot.js'

test('large screens are scaled down, keeping their shape', () => {
  assert.deepEqual(snapshotSize(2560, 1600), { width: 1280, height: 800 })
  assert.deepEqual(snapshotSize(3024, 1964, 1000), { width: 1000, height: 649 })
})

test('small screens are never scaled up', () => {
  assert.deepEqual(snapshotSize(1024, 768), { width: 1024, height: 768 })
})
