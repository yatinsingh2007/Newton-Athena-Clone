// The window should only ever show the app's own page: the Vite dev server in
// development, or the built files on disk in production.
export function isTrustedUrl(url, devServerUrl) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (devServerUrl) return parsed.origin === new URL(devServerUrl).origin
  return parsed.protocol === 'file:'
}
