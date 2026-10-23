import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { TEST_FILES } from './tests.js'

// Copy users.json and the tests into a writable folder. A users.json that's
// already there is kept (it may hold signups from earlier requests); the tests
// are always copied fresh, so an edited test applies straight away.
export async function prepareDataDir(seedDir, target) {
  await mkdir(target, { recursive: true })
  try {
    await copyFile(path.join(seedDir, 'users.json'), path.join(target, 'users.json'), 1) // 1 = COPYFILE_EXCL
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
  for (const file of Object.values(TEST_FILES)) {
    await copyFile(path.join(seedDir, file), path.join(target, file))
  }
  return target
}
