import { cp, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const seedDir = path.join(import.meta.dirname, '..', 'data')

export async function makeDataDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'athena-data-'))
  if (existsSync(seedDir)) await cp(seedDir, dir, { recursive: true })
  return dir
}

export function startApp(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      })
    })
  })
}
