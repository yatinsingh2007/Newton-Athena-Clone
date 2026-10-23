import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTheme, THEME_KEY } from './theme.js'

test('stored choice wins over the OS setting', () => {
  assert.equal(resolveTheme('dark', false), 'dark')
  assert.equal(resolveTheme('light', true), 'light')
})

test('falls back to the OS setting when nothing is stored', () => {
  assert.equal(resolveTheme(null, true), 'dark')
  assert.equal(resolveTheme(null, false), 'light')
})

test('ignores unknown stored values', () => {
  assert.equal(resolveTheme('garbage', false), 'light')
})

test('storage key is athena-theme', () => {
  assert.equal(THEME_KEY, 'athena-theme')
})
