import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSaveQueue } from './saveQueue.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// Lets a queued save start, as it would between two separate clicks.
const tick = () => new Promise((resolve) => setTimeout(resolve))

test('sends the newest state when a queued save runs', async () => {
  const sent = []
  const first = deferred()
  let calls = 0
  const queue = createSaveQueue({
    save: (state) => { sent.push(state); return calls++ === 0 ? first.promise : Promise.resolve() },
  })
  queue.enqueue({ v: 1 })
  await tick()
  queue.enqueue({ v: 2 })
  queue.enqueue({ v: 3 })
  first.resolve()
  await queue.flush()
  assert.deepEqual(sent[0], { v: 1 })
  assert.deepEqual(sent.at(-1), { v: 3 })
})

test('a failed save does not stop later saves', async () => {
  const sent = []
  const errors = []
  let calls = 0
  const queue = createSaveQueue({
    save: async (state) => {
      sent.push(state)
      if (calls++ === 0) throw new Error('offline')
    },
    onError: (err) => errors.push(err.message),
  })
  queue.enqueue({ v: 1 })
  await tick()
  queue.enqueue({ v: 2 })
  await queue.flush()
  assert.deepEqual(errors, ['offline'])
  assert.deepEqual(sent, [{ v: 1 }, { v: 2 }])
})

test('an error handler that throws does not break the queue', async () => {
  const sent = []
  let calls = 0
  const queue = createSaveQueue({
    save: async (state) => {
      sent.push(state)
      if (calls++ === 0) throw new Error('offline')
    },
    onError: () => { throw new Error('handler failed') },
  })
  queue.enqueue({ v: 1 })
  await tick()
  queue.enqueue({ v: 2 })
  await queue.flush()
  assert.deepEqual(sent, [{ v: 1 }, { v: 2 }])
})

test('flush waits for the in-flight save', async () => {
  const pending = deferred()
  let done = false
  const queue = createSaveQueue({ save: () => pending.promise.then(() => { done = true }) })
  queue.enqueue({ v: 1 })
  const flushed = queue.flush().then(() => done)
  pending.resolve()
  assert.equal(await flushed, true)
})

test('saves queued in the same tick send only the newest state', async () => {
  const sent = []
  const queue = createSaveQueue({ save: async (state) => sent.push(state) })
  queue.enqueue({ v: 1 })
  queue.enqueue({ v: 2 })
  await queue.flush()
  assert.deepEqual(sent.at(-1), { v: 2 })
  assert.ok(!sent.some((s) => s.v === 1))
})

test('onSaved runs after each successful save', async () => {
  let saved = 0
  const queue = createSaveQueue({ save: async () => {}, onSaved: () => saved++ })
  queue.enqueue({ v: 1 })
  await queue.flush()
  assert.equal(saved, 1)
})
