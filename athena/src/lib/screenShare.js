const messages = {
  NotAllowedError: 'Screen sharing was cancelled or blocked. Share your screen to continue.',
  blocked:
    'Athena needs Screen Recording permission. Turn it on for Athena in System Settings → Privacy & Security, then quit and reopen Athena.',
  window: 'Share your entire screen, not a single window or tab.',
  ended: 'Screen sharing stopped. Share your screen again to continue.',
}

export function screenErrorMessage(errorName) {
  return messages[errorName] ?? 'Could not share your screen.'
}

// Short status for the screen check; errorName is null before the student has been asked.
export function screenStatusLabel(live, errorName) {
  if (live) return 'Sharing'
  if (!errorName) return 'Not shared'
  if (errorName === 'ended') return 'Stopped'
  return 'Not shared'
}

// Only the whole screen counts. Browsers say what was picked; Electron always
// shares the screen and may not say, so a missing value is fine.
export function isWholeScreen(track) {
  const surface = track?.getSettings?.().displaySurface
  return surface === undefined || surface === 'monitor'
}
