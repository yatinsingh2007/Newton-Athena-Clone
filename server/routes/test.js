import { Router } from 'express'
import {
  deadlineOf,
  findAttempt,
  GRACE_MS,
  isValidAnswers,
  isValidMarked,
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
    if (now() > deadlineOf(attempt, test.durationMinutes) + GRACE_MS) {
      return res.status(410).json({ error: 'Time is up' })
    }

    await saveAttempt(dataDir, { ...attempt, answers, marked: [...new Set(marked)] })
    res.json({ ok: true })
  })

  return router
}
