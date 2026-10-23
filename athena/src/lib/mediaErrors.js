const messages = {
  NotAllowedError: 'Camera and microphone access was blocked. Allow access and try again.',
  NotFoundError: 'No camera or microphone was found.',
  NotReadableError: 'Your camera or microphone is being used by another app.',
}

export function mediaErrorMessage(errorName) {
  return messages[errorName] ?? 'Could not start camera and microphone.'
}
