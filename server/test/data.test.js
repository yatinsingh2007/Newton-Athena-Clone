import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readJson } from '../lib/store.js'

const dataDir = path.join(import.meta.dirname, '..', 'data')

test('questions.json has 10 valid questions', async () => {
  const test = await readJson(dataDir, 'questions.json', null)
  assert.equal(test.durationMinutes, 10)
  assert.ok(test.title)
  if (test.startsAt !== undefined) assert.ok(!Number.isNaN(Date.parse(test.startsAt)), 'startsAt is a date')
  assert.equal(test.questions.length, 10)
  assert.deepEqual(
    test.questions.map((q) => q.id),
    Array.from({ length: 10 }, (_, i) => `q${i + 1}`),
  )
  for (const q of test.questions) {
    assert.ok(q.text, `${q.id} has text`)
    assert.equal(q.options.length, 4, `${q.id} has 4 options`)
    assert.ok(q.options.every((o) => typeof o === 'string' && o.trim()))
    assert.ok(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3)
  }
})

test('practice.json has 10 valid questions and can be taken at any time', async () => {
  const test = await readJson(dataDir, 'practice.json', null)
  assert.ok(test.title)
  assert.equal(test.durationMinutes, 10)
  assert.equal(test.startsAt, undefined)
  assert.equal(test.questions.length, 10)
  assert.equal(new Set(test.questions.map((q) => q.id)).size, 10)
  for (const q of test.questions) {
    assert.ok(q.text, `${q.id} has text`)
    assert.equal(q.options.length, 4, `${q.id} has 4 options`)
    assert.ok(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3)
  }
})

test('users.json has at least 3 users with unique emails', async () => {
  const users = await readJson(dataDir, 'users.json', [])
  assert.ok(users.length >= 3)
  assert.equal(new Set(users.map((u) => u.email)).size, users.length)
  // Demo students have a plain password; signed-up ones a passwordHash.
  for (const u of users) assert.ok(u.id && u.name && u.email && (u.password || u.passwordHash))
})
