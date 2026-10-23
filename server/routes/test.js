import express, { Router } from 'express'
import {
  deadlineOf,
  examInfo as examInfoAt,
  examPhase,
  finalizeAttempt,
  findAttempt,
  freshAttempt,
  GRACE_MS,
  isStarted,
  isValidAnswers,
  isValidMarked,
  attemptOverview,
  recordAway,
  resultOf,
  retakeAttempt,
  settleAttempt,
  updateAttempt,
} from '../lib/attempts.js'
import { requireAuth } from '../lib/auth.js'
import { isJpeg, saveScreenshot } from '../lib/screens.js'
import { DEFAULT_TEST_ID, isTestId, loadTest } from '../lib/tests.js'

function publicQuestions(questions) {
  return questions.map(({ id, text, options }) => ({ id, text, options }))
}

const reply = (status, body) => ({ value: { status, body } })

// The routes for taking one test. Mounted at /api/tests/:testId, and at /api
// for the exam (the routes the app used before there was more than one test).
export function testRoutes({ dataDir, now }) {
  const router = Router({ mergeParams: true })
  const isExpired = (attempt, test) => now() > deadlineOf(attempt, test) + GRACE_MS
  const examInfo = (test) => examInfoAt(test, now())

  router.use(requireAuth(dataDir, 'student'))
  router.use((req, res, next) => {
    req.testId = req.params.testId ?? DEFAULT_TEST_ID
    if (!isTestId(req.testId)) return res.status(404).json({ error: 'No such test' })
    next()
  })

  // Shorthands for this request's test and the student's attempt at it.
  const testOf = (req) => loadTest(dataDir, req.testId)
  const update = (req, fn) => updateAttempt(dataDir, req.user.id, req.testId, fn)

  const settle = (req, test) => settleAttempt(dataDir, req.user.id, req.testId, test, now())

  // The schedule plus where this student stands, for the screen after login.
  router.get('/exam', async (req, res) => {
    const test = await testOf(req)
    res.json({ ...examInfo(test), attempt: attemptOverview(await settle(req, test)) })
  })

  router.get('/test', async (req, res) => {
    const test = await testOf(req)
    const phase = examPhase(test, now())
    if (phase === 'upcoming') return res.json({ status: 'not_started', ...examInfo(test) })

    const attempt = await update(req, (current) => {
      // Missed the exam window: there's nothing left to start.
      if (!isStarted(current) && phase === 'closed') return { value: current }
      // First visit, or the first visit after a retake: the attempt starts now.
      let next = isStarted(current)
        ? current
        : freshAttempt(req.user.id, req.testId, now(), current?.history)
      // Time ran out while the student was away: submit what they had saved.
      if (!next.submittedAt && isExpired(next, test)) {
        next = finalizeAttempt(next, test.questions, now())
      }
      return { next: next === current ? undefined : next, value: next }
    })

    if (!isStarted(attempt)) return res.json({ status: 'closed', ...examInfo(test) })
    if (attempt.submittedAt) {
      return res.json({ status: 'submitted', result: resultOf(attempt) })
    }

    res.json({
      status: 'in_progress',
      title: test.title,
      durationMinutes: test.durationMinutes,
      startedAt: attempt.startedAt,
      endsAt: deadlineOf(attempt, test),
      now: now(),
      answers: attempt.answers,
      marked: attempt.marked,
      questions: publicQuestions(test.questions),
    })
  })

  router.put('/attempt', async (req, res) => {
    const test = await testOf(req)
    const { answers, marked } = req.body ?? {}
    if (!isValidAnswers(answers, test.questions)) {
      return res.status(400).json({ error: 'Invalid answers' })
    }
    if (!isValidMarked(marked, test.questions)) {
      return res.status(400).json({ error: 'Invalid marked list' })
    }

    const { status, body } = await update(req, (attempt) => {
      if (!isStarted(attempt)) return reply(404, { error: 'Test not started' })
      if (attempt.submittedAt) return reply(409, { error: 'Already submitted' })
      if (isExpired(attempt, test)) return reply(410, { error: 'Time is up' })
      return {
        next: { ...attempt, answers, marked: [...new Set(marked)] },
        value: { status: 200, body: { ok: true } },
      }
    })
    res.status(status).json(body)
  })

  router.post('/submit', async (req, res) => {
    const test = await testOf(req)
    const { answers } = req.body ?? {}
    if (answers !== undefined && !isValidAnswers(answers, test.questions)) {
      return res.status(400).json({ error: 'Invalid answers' })
    }

    const { status, body } = await update(req, (attempt) => {
      if (!isStarted(attempt)) return reply(404, { error: 'Test not started' })
      if (attempt.submittedAt) return reply(409, { error: 'Already submitted' })
      // Past the grace period only the answers already saved in time count.
      const graded = answers !== undefined && !isExpired(attempt, test) ? { ...attempt, answers } : attempt
      const next = finalizeAttempt(graded, test.questions, now())
      return { next, value: { status: 200, body: resultOf(next) } }
    })
    res.status(status).json(body)
  })

  router.get('/result', async (req, res) => {
    const attempt = await settle(req, await testOf(req))
    if (!attempt?.submittedAt) return res.status(404).json({ error: 'No result' })
    res.json(resultOf(attempt))
  })

  // The app reports when the student leaves the test window ({ away: true }) and
  // comes back ({ away: false }); the server's clock times it, for the proctor.
  router.post('/away', async (req, res) => {
    const { away } = req.body ?? {}
    if (typeof away !== 'boolean') return res.status(400).json({ error: 'Send { away: true | false }' })
    const test = await testOf(req)
    const { status, body } = await update(req, (attempt) => {
      if (!isStarted(attempt)) return reply(404, { error: 'Test not started' })
      if (attempt.submittedAt) return reply(409, { error: 'Already submitted' })
      if (isExpired(attempt, test)) return reply(410, { error: 'Time is up' })
      const next = recordAway(attempt, away, now())
      return { next: next === attempt ? undefined : next, value: { status: 200, body: { ok: true } } }
    })
    res.status(status).json(body)
  })

  // A JPEG of the student's shared screen, sent by the app every few seconds
  // while the test is in progress, for the proctor.
  router.post('/screen', express.raw({ type: 'image/jpeg', limit: '1mb' }), async (req, res) => {
    if (!isJpeg(req.body)) return res.status(400).json({ error: 'Send a JPEG image' })
    const test = await testOf(req)
    const attempt = await findAttempt(dataDir, req.user.id, req.testId)
    if (!isStarted(attempt)) return res.status(404).json({ error: 'Test not started' })
    if (attempt.submittedAt) return res.status(409).json({ error: 'Already submitted' })
    if (isExpired(attempt, test)) return res.status(410).json({ error: 'Time is up' })
    await saveScreenshot(dataDir, req.testId, req.user.id, now(), req.body)
    res.status(201).json({ ok: true })
  })

  router.post('/retake', async (req, res) => {
    if (examPhase(await testOf(req), now()) === 'closed') {
      return res.status(410).json({ error: 'The test window has closed' })
    }
    const { status, body } = await update(req, (attempt) => {
      if (!isStarted(attempt)) return reply(404, { error: 'Test not started' })
      if (!attempt.submittedAt) return reply(409, { error: 'Submit your current attempt first' })
      return { next: retakeAttempt(attempt), value: { status: 200, body: { ok: true } } }
    })
    res.status(status).json(body)
  })

  return router
}
