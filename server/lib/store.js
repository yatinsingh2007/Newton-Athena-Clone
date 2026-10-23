import { randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

// One promise chain per file, so read-modify-write cycles never interleave.
const locks = new Map()

function withLock(file, fn) {
  const run = (locks.get(file) ?? Promise.resolve()).then(fn)
  const tail = run.catch(() => {})
  locks.set(file, tail)
  tail.then(() => locks.get(file) === tail && locks.delete(file))
  return run
}

async function read(file, fallback) {
  try {
    const text = await readFile(file, 'utf8')
    return text.trim() ? JSON.parse(text) : fallback
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

// Write to a unique temp file and rename so a crash never leaves half-written JSON.
async function write(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n')
  await rename(tmp, file)
}

export function readJson(dataDir, fileName, fallback) {
  return read(path.join(dataDir, fileName), fallback)
}

export function writeJson(dataDir, fileName, value) {
  const file = path.join(dataDir, fileName)
  return withLock(file, () => write(file, value))
}

// fn(current) returns { next?, value }: `next` is written if present, `value` is returned.
export function updateJson(dataDir, fileName, fallback, fn) {
  const file = path.join(dataDir, fileName)
  return withLock(file, async () => {
    const { next, value } = await fn(await read(file, fallback))
    if (next !== undefined) await write(file, next)
    return value
  })
}
