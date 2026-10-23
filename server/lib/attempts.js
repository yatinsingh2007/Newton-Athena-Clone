import { readJson, updateJson } from './store.js'
import { gradeAnswers } from './grade.js'
import { DEFAULT_TEST_ID } from './tests.js'

// Extra time after the deadline so the client's 0:00 auto-submit still lands.
export const GRACE_MS = 10_000

// One attempt per student per test. Attempts saved before there was more than
// one test have no testId and belong to the exam.
export const testIdOf = (attempt) => attempt.testId ?? DEFAULT_TEST_ID
const isFor = (userId, testId) => (a) => a.userId === userId && testIdOf(a) === testId

export async function findAttempt(dataDir, userId, testId = DEFAULT_TEST_ID) {
  const attempts = await readJson(dataDir, 'attempts.json', [])
  return attempts.find(isFor(userId, testId))
}

// Runs fn(attempt) with attempts.json locked, so each check-then-write is atomic.
// fn returns { next?, value }; `next` replaces this student's attempt at that test.
export function updateAttempt(dataDir, userId, testId, fn) {
  return updateJson(dataDir, 'attempts.json', [], async (attempts) => {
    const index = attempts.findIndex(isFor(userId, testId))
    const { next, value } = await fn(index === -1 ? undefined : attempts[index])
    if (next === undefined) return { value }
    const updated = [...attempts]
    if (index === -1) updated.push(next)
    else updated[index] = next
    return { next: updated, value }
  })
}

export function saveAttempt(dataDir, attempt) {
  return updateAttempt(dataDir, attempt.userId, testIdOf(attempt), () => ({ next: attempt }))
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

export function freshAttempt(userId, testId, startedAt, history = []) {
  return {
    userId,
    testId,
    startedAt,
    answers: {},
    marked: [],
    away: [],
    submittedAt: null,
    score: null,
    total: null,
    history,
  }
}

// An attempt whose time ran out counts as submitted, even if the app never sent it.
export function settleAttempt(dataDir, userId, testId, test, now) {
  return updateAttempt(dataDir, userId, testId, (current) => {
    if (isStarted(current) && !current.submittedAt && now > deadlineOf(current, test) + GRACE_MS) {
      const next = finalizeAttempt(current, test.questions, now)
      return { next, value: next }
    }
    return { value: current }
  })
}

// Where a student stands at a test, for the screens after login.
export function attemptOverview(attempt) {
  const status = attemptStatus(attempt)
  return { status, result: status === 'submitted' ? resultOf(attempt) : null }
}

export function attemptStatus(attempt) {
  if (!isStarted(attempt)) return 'not_started'
  return attempt.submittedAt ? 'submitted' : 'in_progress'
}

// Times the student left the test window, as { leftAt, backAt } (backAt is
// null while they're still away). Only the newest MAX_AWAY are kept.
export const MAX_AWAY = 200

export function recordAway(attempt, away, now) {
  const events = attempt.away ?? []
  const last = events.at(-1)
  const isAway = last != null && last.backAt == null
  if (away === isAway) return attempt
  const next = away
    ? [...events, { leftAt: now, backAt: null }]
    : [...events.slice(0, -1), { ...last, backAt: now }]
  return { ...attempt, away: next.slice(-MAX_AWAY) }
}

// Moves a finished attempt into history; the next GET /api/test opens a new one.
export function retakeAttempt(attempt) {
  const { score, total, submittedAt } = attempt
  const history = [...(attempt.history ?? []), { score, total, submittedAt }]
  return freshAttempt(attempt.userId, testIdOf(attempt), null, history)
}

export function resultOf({ score, total, submittedAt, history = [] }) {
  return { score, total, submittedAt, previous: [...history].reverse() }
}
