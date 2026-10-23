import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isWholeScreen, screenErrorMessage, screenStatusLabel } from './screenShare.js'

const track = (settings) => ({ getSettings: () => settings })

test('the whole screen counts, a window or tab does not', () => {
  assert.equal(isWholeScreen(track({ displaySurface: 'monitor' })), true)
  assert.equal(isWholeScreen(track({ displaySurface: 'window' })), false)
  assert.equal(isWholeScreen(track({ displaySurface: 'browser' })), false)
})

test('a capture that does not say what it is counts as the screen', () => {
  assert.equal(isWholeScreen(track({})), true)
})

test('error messages, with a fallback', () => {
  assert.match(screenErrorMessage('blocked'), /Screen Recording/)
  assert.match(screenErrorMessage('ended'), /stopped/)
  assert.equal(screenErrorMessage('Weird'), 'Could not share your screen.')
})

test('status label', () => {
  assert.equal(screenStatusLabel(true, null), 'Sharing')
  assert.equal(screenStatusLabel(false, null), 'Not shared')
  assert.equal(screenStatusLabel(false, 'ended'), 'Stopped')
  assert.equal(screenStatusLabel(false, 'NotAllowedError'), 'Not shared')
})
