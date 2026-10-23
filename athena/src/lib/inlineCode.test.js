import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitInlineCode } from './inlineCode.js'

test('plain text is one text segment', () => {
  assert.deepEqual(splitInlineCode('Hello world'), [{ type: 'text', value: 'Hello world' }])
})

test('backtick pairs become code segments', () => {
  assert.deepEqual(splitInlineCode('What does `useEffect` do?'), [
    { type: 'text', value: 'What does ' },
    { type: 'code', value: 'useEffect' },
    { type: 'text', value: ' do?' },
  ])
})

test('a whole option can be code', () => {
  assert.deepEqual(splitInlineCode('`[2, 4, 6]`'), [{ type: 'code', value: '[2, 4, 6]' }])
})

test('an unmatched backtick stays as text', () => {
  assert.deepEqual(splitInlineCode('a `b` c `d'), [
    { type: 'text', value: 'a ' },
    { type: 'code', value: 'b' },
    { type: 'text', value: ' c `d' },
  ])
})
