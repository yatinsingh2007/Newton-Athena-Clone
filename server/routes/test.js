import { Router } from 'express'
import {
  deadlineOf,
  finalizeAttempt,
  findAttempt,
  GRACE_MS,
  isValidAnswers,
  isValidMarked,
  resultOf,
  saveAttempt,
} from '../lib/attempts.js'
import { requireAuth } from '../lib/auth.js'
import { readJson } from '../lib/store.js'

function publicQuestions(questions) {
  return questions.map(({ id, text, options }) => ({ id, text, options }))
}

export function testRoutes({ dataDir, now }) {
  const router = Router()
  const loadTest = () => readJson(dataDir, 'questions.json', null)
  const isExpired = (attempt, test) =>
    now() > deadlineOf(attempt, test.durationMinutes) + GRACE_MS

  router.use(requireAuth(dataDir))

  router.get('/test', async (req, res) => {
    const test = await loadTest()
    let attempt = await findAttempt(dataDir, req.user.id)
    if (!attempt) {
      attempt = {
        userId: req.user.id,
        startedAt: now(),
        answers: {},
        marked: [],
        submittedAt: null,
        score: null,
        total: null,
      }
      await saveAttempt(dataDir, attempt)
    }

    // Time ran out while the student was away: submit what they had saved.
    if (!attempt.submittedAt && isExpired(attempt, test)) {
      attempt = finalizeAttempt(attempt, test.questions, now())
      await saveAttempt(dataDir, attempt)
    }

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

    const attempt = await findAttempt(dataDir, req.user.id)
    if (!attempt) return res.status(404).json({ error: 'Test not started' })
    if (attempt.submittedAt) return res.status(409).json({ error: 'Already submitted' })
    if (isExpired(attempt, test)) return res.status(410).json({ error: 'Time is up' })

    await saveAttempt(dataDir, { ...attempt, answers, marked: [...new Set(marked)] })
    res.json({ ok: true })
  })

  router.post('/submit', async (req, res) => {
    const test = await loadTest()
    const { answers } = req.body ?? {}
    if (answers !== undefined && !isValidAnswers(answers, test.questions)) {
      return res.status(400).json({ error: 'Invalid answers' })
    }

    let attempt = await findAttempt(dataDir, req.user.id)
    if (!attempt) return res.status(404).json({ error: 'Test not started' })
    if (attempt.submittedAt) return res.status(409).json({ error: 'Already submitted' })

    // Past the grace period only the answers already saved in time count.
    if (answers !== undefined && !isExpired(attempt, test)) {
      attempt = { ...attempt, answers }
    }
    attempt = finalizeAttempt(attempt, test.questions, now())
    await saveAttempt(dataDir, attempt)
    res.json(resultOf(attempt))
  })

  router.get('/result', async (req, res) => {
    const attempt = await findAttempt(dataDir, req.user.id)
    if (!attempt?.submittedAt) return res.status(404).json({ error: 'No result' })
    res.json(resultOf(attempt))
  })

  return router
}
