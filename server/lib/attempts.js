import { readJson, updateJson } from './store.js'
import { gradeAnswers } from './grade.js'

// Extra time after the deadline so the client's 0:00 auto-submit still lands.
export const GRACE_MS = 10_000

export async function findAttempt(dataDir, userId) {
  const attempts = await readJson(dataDir, 'attempts.json', [])
  return attempts.find((a) => a.userId === userId)
}

// Runs fn(attempt) with attempts.json locked, so each check-then-write is atomic.
// fn returns { next?, value }; `next` replaces this student's attempt.
export function updateAttempt(dataDir, userId, fn) {
  return updateJson(dataDir, 'attempts.json', [], async (attempts) => {
    const index = attempts.findIndex((a) => a.userId === userId)
    const { next, value } = await fn(index === -1 ? undefined : attempts[index])
    if (next === undefined) return { value }
    const updated = [...attempts]
    if (index === -1) updated.push(next)
    else updated[index] = next
    return { next: updated, value }
  })
}

export function saveAttempt(dataDir, attempt) {
  return updateAttempt(dataDir, attempt.userId, () => ({ next: attempt }))
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
