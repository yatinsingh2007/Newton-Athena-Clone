import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { readStoredTheme, resolveTheme } from './lib/theme.js'

// Set the theme before the first paint so dark mode doesn't flash white.
document.documentElement.dataset.theme = resolveTheme(
  readStoredTheme(),
  window.matchMedia('(prefers-color-scheme: dark)').matches,
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
