import { Router } from 'express'
import { findAttempt, saveAttempt } from '../lib/attempts.js'
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

  return router
}
