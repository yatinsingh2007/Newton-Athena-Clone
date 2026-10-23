import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

// Copy users.json and questions.json into a writable folder, leaving any copy
// that's already there (it may hold signups from earlier requests).
export async function prepareDataDir(seedDir, target) {
  await mkdir(target, { recursive: true })
  for (const file of ['users.json', 'questions.json']) {
    try {
      await copyFile(path.join(seedDir, file), path.join(target, file), 1) // 1 = COPYFILE_EXCL
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }
  }
  return target
}
