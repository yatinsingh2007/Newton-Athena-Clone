import { Router } from 'express'
import { attemptOverview, examInfo, settleAttempt } from '../lib/attempts.js'
import { requireAuth } from '../lib/auth.js'
import { loadTest, TEST_FILES } from '../lib/tests.js'

const testIds = Object.keys(TEST_FILES)

// Lists of the tests: GET /api/tests for a student (with where they stand at
// each), GET /api/proctor/tests for a proctor.
export function catalogRoutes({ dataDir, now }) {
  const router = Router()

  router.get('/tests', requireAuth(dataDir, 'student'), async (req, res) => {
    const at = now()
    const tests = await Promise.all(
      testIds.map(async (id) => {
        const test = await loadTest(dataDir, id)
        const attempt = await settleAttempt(dataDir, req.user.id, id, test, at)
        return { id, ...examInfo(test, at), attempt: attemptOverview(attempt) }
      }),
    )
    res.json({ now: at, tests })
  })

  router.get('/proctor/tests', requireAuth(dataDir, 'proctor'), async (req, res) => {
    const at = now()
    const tests = await Promise.all(testIds.map(async (id) => ({ id, ...examInfo(await loadTest(dataDir, id), at) })))
    res.json({ now: at, tests })
  })

  return router
}
