import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { gradeAnswers } from '../lib/grade.js'
import { readJson } from '../lib/store.js'

const { questions } = await readJson(path.join(import.meta.dirname, '..', 'data'), 'questions.json')
const allCorrect = Object.fromEntries(questions.map((q) => [q.id, q.answerIndex]))

test('all correct scores 10/10', () => {
  assert.deepEqual(gradeAnswers(questions, allCorrect), { score: 10, total: 10 })
})

test('none answered scores 0/10', () => {
  assert.deepEqual(gradeAnswers(questions, {}), { score: 0, total: 10 })
})

test('mixed answers count only correct ones', () => {
  const answers = { ...allCorrect, q1: (allCorrect.q1 + 1) % 4, q2: (allCorrect.q2 + 1) % 4 }
  delete answers.q3
  assert.deepEqual(gradeAnswers(questions, answers), { score: 7, total: 10 })
})
