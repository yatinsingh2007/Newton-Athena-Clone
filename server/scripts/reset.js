import { rm } from 'node:fs/promises'
import path from 'node:path'
import { writeJson } from '../lib/store.js'

const dataDir = path.join(import.meta.dirname, '..', 'data')

await writeJson(dataDir, 'attempts.json', [])
await writeJson(dataDir, 'sessions.json', {})
await rm(path.join(dataDir, 'screens'), { recursive: true, force: true })
console.log('Reset attempts, sessions and screenshots.')
