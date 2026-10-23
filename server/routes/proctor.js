import { Router } from 'express'
import { examInfo, isStarted } from '../lib/attempts.js'
import { publicUser, requireAuth } from '../lib/auth.js'
import { listScreenshots, screenshotPath } from '../lib/screens.js'
import { readJson } from '../lib/store.js'
import { allUsers } from '../lib/users.js'

function attemptSummary(attempt) {
  if (!isStarted(attempt)) return { status: 'not_started' }
  const { startedAt, submittedAt, score, total, away = [] } = attempt
  return { status: submittedAt ? 'submitted' : 'in_progress', startedAt, submittedAt, score, total, away }
}

// What proctors see: every student, how far they've got, and their screen.
export function proctorRoutes({ dataDir, now }) {
  const router = Router()
  router.use(requireAuth(dataDir, 'proctor'))

  const findStudent = async (id) =>
    (await allUsers(dataDir)).map(publicUser).find((u) => u.id === id && u.role === 'student')

  router.get('/students', async (req, res) => {
    const [test, users, attempts] = await Promise.all([
      readJson(dataDir, 'questions.json', null),
      allUsers(dataDir),
      readJson(dataDir, 'attempts.json', []),
    ])
    const students = users.map(publicUser).filter((u) => u.role === 'student')
    res.json({
      exam: examInfo(test, now()),
      students: await Promise.all(
        students.map(async (student) => {
          const screenshots = await listScreenshots(dataDir, student.id)
          return {
            ...student,
            attempt: attemptSummary(attempts.find((a) => a.userId === student.id)),
            lastScreenshotAt: screenshots.at(-1) ?? null,
          }
        }),
      ),
    })
  })

  router.get('/students/:id/screens', async (req, res) => {
    if (!(await findStudent(req.params.id))) return res.status(404).json({ error: 'No such student' })
    res.json({ screenshots: await listScreenshots(dataDir, req.params.id) })
  })

  router.get('/students/:id/screens/:takenAt', async (req, res) => {
    const { id, takenAt } = req.params
    if (!/^\d+$/.test(takenAt) || !(await findStudent(id))) return res.status(404).json({ error: 'Not found' })
    if (!(await listScreenshots(dataDir, id)).includes(Number(takenAt))) {
      return res.status(404).json({ error: 'Not found' })
    }
    // A screenshot never changes once taken.
    res.set('Cache-Control', 'private, max-age=86400, immutable')
    res.type('image/jpeg').sendFile(screenshotPath(dataDir, id, takenAt))
  })

  return router
}
