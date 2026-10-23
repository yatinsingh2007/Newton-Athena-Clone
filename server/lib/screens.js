import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Screenshots of each student's shared screen during a test, as
// screens/<testId>/<userId>/<takenAt>.jpg. Only the newest MAX_SCREENSHOTS per
// student per test are kept.
export const MAX_SCREENSHOTS = 120

const userDir = (dataDir, testId, userId) => path.join(dataDir, 'screens', testId, userId)

export const screenshotPath = (dataDir, testId, userId, takenAt) =>
  path.join(userDir(dataDir, testId, userId), `${takenAt}.jpg`)

// Every JPEG starts with these bytes.
export const isJpeg = (data) =>
  Buffer.isBuffer(data) && data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff

// Times the student's screenshots were taken, oldest first.
export async function listScreenshots(dataDir, testId, userId) {
  let files
  try {
    files = await readdir(userDir(dataDir, testId, userId))
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  return files
    .map((f) => /^(\d+)\.jpg$/.exec(f)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b)
}

export async function saveScreenshot(dataDir, testId, userId, takenAt, jpeg) {
  await mkdir(userDir(dataDir, testId, userId), { recursive: true })
  await writeFile(screenshotPath(dataDir, testId, userId, takenAt), jpeg)
  const all = await listScreenshots(dataDir, testId, userId)
  const extra = all.slice(0, Math.max(0, all.length - MAX_SCREENSHOTS))
  await Promise.all(extra.map((at) => rm(screenshotPath(dataDir, testId, userId, at), { force: true })))
}
