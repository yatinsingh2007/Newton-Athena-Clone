import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readJson, writeJson } from '../lib/store.js'
import { makeDataDir } from './helpers.js'

test('readJson returns fallback for missing file', async () => {
  const dir = await makeDataDir()
  assert.deepEqual(await readJson(dir, 'nope.json', []), [])
})

test('readJson returns fallback for empty file', async () => {
  const dir = await makeDataDir()
  await writeFile(path.join(dir, 'empty.json'), '')
  assert.deepEqual(await readJson(dir, 'empty.json', {}), {})
})

test('writeJson then readJson round-trips', async () => {
  const dir = await makeDataDir()
  const value = [{ id: 'a', n: 1 }]
  await writeJson(dir, 'things.json', value)
  assert.deepEqual(await readJson(dir, 'things.json', null), value)
})

test('writeJson leaves no .tmp file behind', async () => {
  const dir = await makeDataDir()
  await writeJson(dir, 'things.json', { a: 1 })
  const files = await readdir(dir)
  assert.ok(!files.some((f) => f.endsWith('.tmp')))
})
