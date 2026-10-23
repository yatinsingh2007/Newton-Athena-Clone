import { test } from 'node:test'
import assert from 'node:assert/strict'
import { questionStatus, summarize } from './questionStatus.js'

const state = { answers: { q1: 0, q3: 2 }, marked: ['q3', 'q4'], visited: new Set(['q1', 'q2', 'q3', 'q4']) }

test('not visited', () => {
  assert.equal(questionStatus('q5', state), 'not-visited')
})

test('visited but not answered', () => {
  assert.equal(questionStatus('q2', state), 'not-answered')
})

test('answered', () => {
  assert.equal(questionStatus('q1', state), 'answered')
})

test('marked without an answer', () => {
  assert.equal(questionStatus('q4', state), 'marked')
})

test('answered and marked', () => {
  assert.equal(questionStatus('q3', state), 'answered-marked')
})

test('answer 0 counts as answered', () => {
  assert.equal(questionStatus('q1', { answers: { q1: 0 }, marked: [], visited: new Set() }), 'answered')
})

test('summarize counts answered and marked', () => {
  const questions = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => ({ id }))
  assert.deepEqual(summarize(questions, state.answers, state.marked), { answered: 2, marked: 2, total: 5 })
})
