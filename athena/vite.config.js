import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'

// Production-only: the dev server needs inline scripts for hot reload.
function contentSecurityPolicy(apiUrl) {
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    `connect-src ${new URL(apiUrl).origin}`,
  ].join('; ')

  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Relative asset paths so the built app loads from disk inside Electron.
  base: './',
  server: { port: 5173, strictPort: true },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    contentSecurityPolicy(loadEnv(mode, import.meta.dirname).VITE_API_URL || 'http://localhost:4747'),
  ],
}))
