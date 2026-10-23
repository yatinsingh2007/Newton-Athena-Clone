import { Router } from 'express'
import {
  deadlineOf,
  finalizeAttempt,
  GRACE_MS,
  isValidAnswers,
  isValidMarked,
  resultOf,
  updateAttempt,
} from '../lib/attempts.js'
import { requireAuth } from '../lib/auth.js'
import { readJson } from '../lib/store.js'

function publicQuestions(questions) {
  return questions.map(({ id, text, options }) => ({ id, text, options }))
}

const reply = (status, body) => ({ value: { status, body } })

export function testRoutes({ dataDir, now }) {
  const router = Router()
  const loadTest = () => readJson(dataDir, 'questions.json', null)
  const isExpired = (attempt, test) =>
    now() > deadlineOf(attempt, test.durationMinutes) + GRACE_MS

  router.use(requireAuth(dataDir))

  router.get('/test', async (req, res) => {
    const test = await loadTest()
    const attempt = await updateAttempt(dataDir, req.user.id, (current) => {
      let next = current ?? {
        userId: req.user.id,
        startedAt: now(),
        answers: {},
        marked: [],
        submittedAt: null,
        score: null,
        total: null,
      }
      // Time ran out while the student was away: submit what they had saved.
      if (!next.submittedAt && isExpired(next, test)) {
        next = finalizeAttempt(next, test.questions, now())
      }
      return { next: next === current ? undefined : next, value: next }
    })

    if (attempt.submittedAt) {
      return res.json({ status: 'submitted', result: resultOf(attempt) })
    }

    res.json({
      status: 'in_progress',
      title: test.title,
      durationMinutes: test.durationMinutes,
      startedAt: attempt.startedAt,
      now: now(),
      answers: attempt.answers,
      marked: attempt.marked,
      questions: publicQuestions(test.questions),
    })
  })

  router.put('/attempt', async (req, res) => {
    const test = await loadTest()
    const { answers, marked } = req.body ?? {}
    if (!isValidAnswers(answers, test.questions)) {
      return res.status(400).json({ error: 'Invalid answers' })
    }
    if (!isValidMarked(marked, test.questions)) {
      return res.status(400).json({ error: 'Invalid marked list' })
    }

    const { status, body } = await updateAttempt(dataDir, req.user.id, (attempt) => {
      if (!attempt) return reply(404, { error: 'Test not started' })
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
    const test = await loadTest()
    const { answers } = req.body ?? {}
    if (answers !== undefined && !isValidAnswers(answers, test.questions)) {
      return res.status(400).json({ error: 'Invalid answers' })
    }

    const { status, body } = await updateAttempt(dataDir, req.user.id, (attempt) => {
      if (!attempt) return reply(404, { error: 'Test not started' })
      if (attempt.submittedAt) return reply(409, { error: 'Already submitted' })
      // Past the grace period only the answers already saved in time count.
      const graded = answers !== undefined && !isExpired(attempt, test) ? { ...attempt, answers } : attempt
      const next = finalizeAttempt(graded, test.questions, now())
      return { next, value: { status: 200, body: resultOf(next) } }
    })
    res.status(status).json(body)
  })

  router.get('/result', async (req, res) => {
    const test = await loadTest()
    // An attempt whose time ran out counts as submitted, even if the app never sent it.
    const attempt = await updateAttempt(dataDir, req.user.id, (current) => {
      if (current && !current.submittedAt && isExpired(current, test)) {
        const next = finalizeAttempt(current, test.questions, now())
        return { next, value: next }
      }
      return { value: current }
    })
    if (!attempt?.submittedAt) return res.status(404).json({ error: 'No result' })
    res.json(resultOf(attempt))
  })

  return router
}
