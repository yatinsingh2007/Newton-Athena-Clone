import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getMediaStatus, registerMediaIpc, requestMediaAccess, settingsUrl } from './media.js'

function fakePrefs({ camera = 'granted', microphone = 'granted', ask = {} } = {}) {
  const asked = []
  const statuses = { camera, microphone }
  return {
    asked,
    getMediaAccessStatus: (type) => statuses[type],
    askForMediaAccess: async (type) => {
      asked.push(type)
      const ok = ask[type] ?? true
      statuses[type] = ok ? 'granted' : 'denied'
      return ok
    },
  }
}

test('linux status is granted for both', async () => {
  const status = await getMediaStatus({ platform: 'linux', systemPreferences: fakePrefs({ camera: 'denied' }) })
  assert.deepEqual(status, { camera: 'granted', microphone: 'granted' })
})

test('darwin status reads system preferences', async () => {
  const status = await getMediaStatus({
    platform: 'darwin',
    systemPreferences: fakePrefs({ camera: 'not-determined', microphone: 'denied' }),
  })
  assert.deepEqual(status, { camera: 'not-determined', microphone: 'denied' })
})

test('darwin request asks for camera then microphone', async () => {
  const systemPreferences = fakePrefs({ camera: 'not-determined', microphone: 'not-determined' })
  const result = await requestMediaAccess({ platform: 'darwin', systemPreferences })
  assert.deepEqual(systemPreferences.asked, ['camera', 'microphone'])
  assert.deepEqual(result, { camera: 'granted', microphone: 'granted', granted: true })
})

test('granted is false if microphone is denied', async () => {
  const systemPreferences = fakePrefs({ ask: { microphone: false } })
  const result = await requestMediaAccess({ platform: 'darwin', systemPreferences })
  assert.equal(result.granted, false)
  assert.equal(result.microphone, 'denied')
})

test('win32 request returns status without prompting', async () => {
  const systemPreferences = fakePrefs({ camera: 'denied' })
  const result = await requestMediaAccess({ platform: 'win32', systemPreferences })
  assert.deepEqual(systemPreferences.asked, [])
  assert.deepEqual(result, { camera: 'denied', microphone: 'granted', granted: false })
})

test('registerMediaIpc registers the three channels', async () => {
  const handlers = {}
  const opened = []
  registerMediaIpc({
    ipcMain: { handle: (channel, fn) => { handlers[channel] = fn } },
    systemPreferences: fakePrefs(),
    shell: { openExternal: async (url) => opened.push(url) },
    platform: 'darwin',
  })
  assert.deepEqual(Object.keys(handlers).sort(), ['media:open-settings', 'media:request', 'media:status'])
  await handlers['media:open-settings']()
  assert.deepEqual(opened, ['x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'])
  assert.deepEqual(await handlers['media:status'](), { camera: 'granted', microphone: 'granted' })
})

test('open-settings picks the microphone pane when only the mic is denied', async () => {
  const handlers = {}
  const opened = []
  registerMediaIpc({
    ipcMain: { handle: (channel, fn) => { handlers[channel] = fn } },
    systemPreferences: fakePrefs({ camera: 'granted', microphone: 'denied' }),
    shell: { openExternal: async (url) => opened.push(url) },
    platform: 'darwin',
  })
  await handlers['media:open-settings']()
  assert.deepEqual(opened, ['x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'])
})

test('settingsUrl on windows uses the microphone page when needed', () => {
  assert.equal(settingsUrl('win32', { camera: 'granted', microphone: 'denied' }), 'ms-settings:privacy-microphone')
  assert.equal(settingsUrl('win32', { camera: 'denied', microphone: 'denied' }), 'ms-settings:privacy-webcam')
  assert.equal(settingsUrl('linux', { camera: 'denied', microphone: 'granted' }), null)
})
