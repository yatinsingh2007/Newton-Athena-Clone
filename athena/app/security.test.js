import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedUrl } from './security.js'

const dev = 'http://localhost:5173'

test('the dev server page is trusted in development', () => {
  assert.equal(isTrustedUrl('http://localhost:5173/', dev), true)
  assert.equal(isTrustedUrl('http://localhost:5173/src/main.jsx', dev), true)
})

test('the built page on disk is trusted in production', () => {
  assert.equal(isTrustedUrl('file:///Applications/Athena/dist/index.html', undefined), true)
})

test('other origins are not trusted', () => {
  assert.equal(isTrustedUrl('https://evil.example/', dev), false)
  assert.equal(isTrustedUrl('http://localhost:5174/', dev), false)
  assert.equal(isTrustedUrl('http://localhost:5173.evil.example/', dev), false)
})

test('file pages are not trusted while running the dev server', () => {
  assert.equal(isTrustedUrl('file:///etc/passwd', dev), false)
})

test('garbage is not trusted', () => {
  assert.equal(isTrustedUrl('', dev), false)
  assert.equal(isTrustedUrl('not a url', undefined), false)
})
