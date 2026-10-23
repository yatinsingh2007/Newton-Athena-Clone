import express from 'express'

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

  return app
}
