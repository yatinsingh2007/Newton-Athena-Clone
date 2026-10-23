import { readJson, writeJson } from './store.js'
import { gradeAnswers } from './grade.js'

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

export function isValidAnswers(answers, questions) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false
  const ids = new Set(questions.map((q) => q.id))
  return Object.entries(answers).every(
    ([id, choice]) => ids.has(id) && Number.isInteger(choice) && choice >= 0 && choice <= 3,
  )
}

export function isValidMarked(marked, questions) {
  if (!Array.isArray(marked)) return false
  const ids = new Set(questions.map((q) => q.id))
  return marked.every((id) => ids.has(id))
}

export function finalizeAttempt(attempt, questions, now) {
  return { ...attempt, ...gradeAnswers(questions, attempt.answers), submittedAt: now }
}

export function resultOf({ score, total, submittedAt }) {
  return { score, total, submittedAt }
}
