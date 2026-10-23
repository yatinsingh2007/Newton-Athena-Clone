import { useEffect, useState } from 'react'
import { readStoredTheme, resolveTheme, storeTheme } from '../lib/theme.js'

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function useTheme() {
  const [theme, setTheme] = useState(() => resolveTheme(readStoredTheme(), darkQuery.matches))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Follow the OS setting until the student picks a theme themselves.
  useEffect(() => {
    const onChange = (e) => {
      if (!readStoredTheme()) setTheme(e.matches ? 'dark' : 'light')
    }
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    storeTheme(next)
    setTheme(next)
  }

  return { theme, toggle }
}
