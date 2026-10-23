import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deviceStatusLabel, mediaErrorMessage } from './mediaErrors.js'

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

test('device label is Working when the device is live', () => {
  assert.equal(deviceStatusLabel(true, 'NotAllowedError'), 'Working')
})

test('device label is Not checked before asking', () => {
  assert.equal(deviceStatusLabel(false, null), 'Not checked')
})

test('device label follows the error cause', () => {
  assert.equal(deviceStatusLabel(false, 'NotAllowedError'), 'Not allowed')
  assert.equal(deviceStatusLabel(false, 'NotFoundError'), 'Not found')
  assert.equal(deviceStatusLabel(false, 'NotReadableError'), 'In use')
  assert.equal(deviceStatusLabel(false, 'AbortError'), 'Not working')
})

test('device label after a device stopped mid-check', () => {
  assert.equal(deviceStatusLabel(false, 'ended'), 'Disconnected')
})

test('device stopped mid-check', () => {
  assert.equal(
    mediaErrorMessage('ended'),
    'Your camera or microphone stopped working. Check it is connected and try again.',
  )
})
