import { readJson, writeJson } from './store.js'

// Extra time after the deadline so the client's 0:00 auto-submit still lands.
export const GRACE_MS = 10_000

export async function findAttempt(dataDir, userId) {
  const attempts = await readJson(dataDir, 'attempts.json', [])
  return attempts.find((a) => a.userId === userId)
}

export async function saveAttempt(dataDir, attempt) {
  const attempts = await readJson(dataDir, 'attempts.json', [])
  const index = attempts.findIndex((a) => a.userId === attempt.userId)
  if (index === -1) attempts.push(attempt)
  else attempts[index] = attempt
  await writeJson(dataDir, 'attempts.json', attempts)
}

export function deadlineOf(attempt, durationMinutes) {
  return attempt.startedAt + durationMinutes * 60_000
}
