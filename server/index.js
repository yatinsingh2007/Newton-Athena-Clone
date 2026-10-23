import path from 'node:path'
import { createApp } from './app.js'

const port = process.env.PORT || 4747
const app = createApp({ dataDir: path.join(import.meta.dirname, 'data') })

app.listen(port, () => {
  console.log(`Athena server running at http://localhost:${port}`)
})
