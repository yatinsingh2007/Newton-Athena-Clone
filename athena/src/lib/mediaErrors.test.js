import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaErrorMessage } from './mediaErrors.js'

test('blocked access', () => {
  assert.equal(
    mediaErrorMessage('NotAllowedError'),
    'Camera and microphone access was blocked. Allow access and try again.',
  )
})

test('no device', () => {
  assert.equal(mediaErrorMessage('NotFoundError'), 'No camera or microphone was found.')
})

test('device busy', () => {
  assert.equal(
    mediaErrorMessage('NotReadableError'),
    'Your camera or microphone is being used by another app.',
  )
})

test('anything else', () => {
  assert.equal(mediaErrorMessage('AbortError'), 'Could not start camera and microphone.')
  assert.equal(mediaErrorMessage(undefined), 'Could not start camera and microphone.')
})
