// How often a screenshot of the shared screen goes to the proctor, and how big.
export const SNAPSHOT_MS = 15_000
export const SNAPSHOT_MAX_WIDTH = 1280
export const SNAPSHOT_QUALITY = 0.6

// Scales a screen down to at most maxWidth wide, keeping its shape.
export function snapshotSize(width, height, maxWidth = SNAPSHOT_MAX_WIDTH) {
  const scale = Math.min(1, maxWidth / width)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// A JPEG of the video's current frame, or null if it has no picture yet.
export function captureFrame(video) {
  if (!video.videoWidth) return Promise.resolve(null)
  const { width, height } = snapshotSize(video.videoWidth, video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(video, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', SNAPSHOT_QUALITY))
}
