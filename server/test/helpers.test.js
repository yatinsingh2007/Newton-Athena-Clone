import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { makeDataDir } from './helpers.js'

test('makeDataDir copies only the seed files, never local runtime data', async () => {
  const seedDir = path.join(import.meta.dirname, '..', 'data')
  await writeFile(path.join(seedDir, 'attempts.json'), '[{"userId":"u1"}]\n')
  try {
    const dir = await makeDataDir()
    assert.deepEqual((await readdir(dir)).sort(), ['questions.json', 'users.json'])
  } finally {
    await writeFile(path.join(seedDir, 'attempts.json'), '[]\n')
  }
})
