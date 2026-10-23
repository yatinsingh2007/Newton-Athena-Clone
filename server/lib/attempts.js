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

// With `startsAt` in questions.json the test is open to everyone at the same
// time: from startsAt for durationMinutes. Without it, each student gets
// durationMinutes from the moment they first open the test.
export function examWindow(test) {
  if (!test.startsAt) return null
  const startsAt = Date.parse(test.startsAt)
  return { startsAt, endsAt: startsAt + test.durationMinutes * 60_000 }
}

// 'upcoming' before the window opens, 'closed' once it (and the grace period) is over.
export function examPhase(test, now) {
  const window = examWindow(test)
  if (!window) return 'open'
  if (now < window.startsAt) return 'upcoming'
  if (now > window.endsAt + GRACE_MS) return 'closed'
  return 'open'
}

// The exam's schedule and the server's clock, for the app's live countdowns.
export function examInfo(test, now) {
  const window = examWindow(test)
  return {
    title: test.title,
    durationMinutes: test.durationMinutes,
    startsAt: window?.startsAt ?? null,
    endsAt: window?.endsAt ?? null,
    now,
  }
}

export function deadlineOf(attempt, test) {
  return examWindow(test)?.endsAt ?? attempt.startedAt + test.durationMinutes * 60_000
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

// A not-yet-opened attempt (after a retake) has no start time.
export const isStarted = (attempt) => attempt?.startedAt != null

export function freshAttempt(userId, startedAt, history = []) {
  return { userId, startedAt, answers: {}, marked: [], submittedAt: null, score: null, total: null, history }
}

// Moves a finished attempt into history; the next GET /api/test opens a new one.
export function retakeAttempt(attempt) {
  const { score, total, submittedAt } = attempt
  return freshAttempt(attempt.userId, null, [...(attempt.history ?? []), { score, total, submittedAt }])
}

export function resultOf({ score, total, submittedAt, history = [] }) {
  return { score, total, submittedAt, previous: [...history].reverse() }
}
