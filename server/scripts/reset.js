import path from 'node:path'
import { writeJson } from '../lib/store.js'

const dataDir = path.join(import.meta.dirname, '..', 'data')

await writeJson(dataDir, 'attempts.json', [])
await writeJson(dataDir, 'sessions.json', {})
console.log('Reset attempts and sessions.')
