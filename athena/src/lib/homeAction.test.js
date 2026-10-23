import { test } from 'node:test'
import assert from 'node:assert/strict'
import { homeAction } from './homeAction.js'

const clock = (phase, status) => ({ phase, exam: { attempt: { status } } })

test('a finished test shows its result, whatever the window', () => {
  for (const phase of ['upcoming', 'open', 'closed', 'anytime']) {
    assert.equal(homeAction(clock(phase, 'submitted')), 'result')
  }
})

test('before the window opens the student waits', () => {
  assert.equal(homeAction(clock('upcoming', 'not_started')), 'wait')
})

test('while the window is open the student can start or resume', () => {
  assert.equal(homeAction(clock('open', 'not_started')), 'start')
  assert.equal(homeAction(clock('anytime', 'not_started')), 'start')
  assert.equal(homeAction(clock('open', 'in_progress')), 'resume')
})

test('after the window closes an unstarted test is missed', () => {
  assert.equal(homeAction(clock('closed', 'not_started')), 'missed')
})
