import express from 'express'
import { authRoutes } from './routes/auth.js'
import { catalogRoutes } from './routes/catalog.js'
import { proctorRoutes } from './routes/proctor.js'
import { testRoutes } from './routes/test.js'

function cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
}

export function createApp({ dataDir, now = () => Date.now() }) {
  const app = express()
  app.use(cors)
  app.use(express.json())

  app.get('/api/health', (req, res) => res.json({ ok: true }))
  app.use('/api', authRoutes({ dataDir }))
  // Before the student routes, which turn away anyone who isn't a student.
  app.use('/api', catalogRoutes({ dataDir, now }))
  app.use('/api/proctor', proctorRoutes({ dataDir, now }))
  // Each test at /api/tests/<id>/..., and the exam also at /api/... as before.
  const tests = testRoutes({ dataDir, now })
  app.use('/api/tests/:testId', tests)
  app.use('/api', tests)

  return app
}
