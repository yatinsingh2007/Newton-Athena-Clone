import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { makeDataDir } from './helpers.js'

// Uses a throwaway source folder so the real server/data is never touched.
test('makeDataDir copies only the seed files, never runtime data', async () => {
  const source = await makeDataDir()
  await writeFile(path.join(source, 'attempts.json'), '[{"userId":"u1"}]\n')
  await writeFile(path.join(source, 'sessions.json'), '{"t":"u1"}\n')
  const dir = await makeDataDir({
    'questions.json': path.join(source, 'questions.json'),
    'users.json': path.join(source, 'users.json'),
  })
  assert.deepEqual((await readdir(dir)).sort(), ['questions.json', 'users.json'])
})
