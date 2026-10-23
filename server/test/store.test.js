import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readJson, updateJson, writeJson } from '../lib/store.js'
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

test('concurrent writeJson calls all succeed and leave valid JSON', async () => {
  const dir = await makeDataDir()
  const writes = Array.from({ length: 50 }, (_, i) =>
    writeJson(dir, 'race.json', { i, pad: 'x'.repeat((i % 7) * 500) }),
  )
  await Promise.all(writes)
  const value = await readJson(dir, 'race.json', null)
  assert.equal(typeof value.i, 'number')
})

test('updateJson serializes read-modify-write', async () => {
  const dir = await makeDataDir()
  await writeJson(dir, 'count.json', { n: 0 })
  await Promise.all(
    Array.from({ length: 50 }, () => updateJson(dir, 'count.json', { n: 0 }, (v) => ({ next: { n: v.n + 1 } }))),
  )
  assert.deepEqual(await readJson(dir, 'count.json', null), { n: 50 })
})

test('updateJson returns the callback value and skips writing without next', async () => {
  const dir = await makeDataDir()
  const value = await updateJson(dir, 'none.json', [], (v) => ({ value: v.length }))
  assert.equal(value, 0)
  assert.deepEqual(await readdir(dir).then((f) => f.includes('none.json')), false)
})
