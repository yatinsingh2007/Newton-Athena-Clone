import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prepareDataDir } from '../lib/dataDir.js'
import { makeDataDir } from './helpers.js'

test('copies the seed files into an empty writable folder', async () => {
  const seedDir = await makeDataDir()
  const target = path.join(await mkdtemp(path.join(tmpdir(), 'athena-tmp-')), 'data')
  await prepareDataDir(seedDir, target)
  const questions = JSON.parse(await readFile(path.join(target, 'questions.json'), 'utf8'))
  assert.equal(questions.questions.length, 10)
  JSON.parse(await readFile(path.join(target, 'users.json'), 'utf8'))
})

test('keeps files that are already there, so signups survive a warm restart', async () => {
  const seedDir = await makeDataDir()
  const target = await mkdtemp(path.join(tmpdir(), 'athena-tmp-'))
  await writeFile(path.join(target, 'users.json'), '[{"id":"x"}]\n')
  await prepareDataDir(seedDir, target)
  assert.equal(await readFile(path.join(target, 'users.json'), 'utf8'), '[{"id":"x"}]\n')
})
