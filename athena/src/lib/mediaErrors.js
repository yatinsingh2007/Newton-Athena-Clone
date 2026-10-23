const messages = {
  NotAllowedError: 'Camera and microphone access was blocked. Allow access and try again.',
  NotFoundError: 'No camera or microphone was found.',
  NotReadableError: 'Your camera or microphone is being used by another app.',
  ended: 'Your camera or microphone stopped working. Check it is connected and try again.',
}

export function mediaErrorMessage(errorName) {
  return messages[errorName] ?? 'Could not start camera and microphone.'
}

const labels = {
  NotAllowedError: 'Not allowed',
  NotFoundError: 'Not found',
  NotReadableError: 'In use',
  ended: 'Disconnected',
}

// Short status for one device; errorName is null before the student has been asked.
export function deviceStatusLabel(ok, errorName) {
  if (ok) return 'Working'
  if (!errorName) return 'Not checked'
  return labels[errorName] ?? 'Not working'
}
