import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function readJson(dataDir, fileName, fallback) {
  try {
    const text = await readFile(path.join(dataDir, fileName), 'utf8')
    return text.trim() ? JSON.parse(text) : fallback
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

// Write to a temp file and rename so a crash never leaves half-written JSON.
export async function writeJson(dataDir, fileName, value) {
  const target = path.join(dataDir, fileName)
  const tmp = `${target}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n')
  await rename(tmp, target)
}
