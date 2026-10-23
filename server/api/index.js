import path from 'node:path'
import { createApp } from '../app.js'
import { prepareDataDir } from '../lib/dataDir.js'

// Vercel entry point. Its disk is read-only except /tmp, and /tmp is wiped
// whenever Vercel starts a fresh instance, so data written here is temporary.
const seedDir = path.join(import.meta.dirname, '..', 'data')
const dataDir = await prepareDataDir(seedDir, '/tmp/athena-data')

export default createApp({ dataDir })
