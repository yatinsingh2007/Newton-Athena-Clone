import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// Production-only: the dev server needs inline scripts for hot reload.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src http://localhost:4747",
].join('; ')

function contentSecurityPolicy() {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the built app loads from disk inside Electron.
  base: './',
  server: { port: 5173, strictPort: true },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    contentSecurityPolicy(),
  ],
})
