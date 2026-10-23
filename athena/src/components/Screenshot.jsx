import { useEffect, useState } from 'react'

// One of a student's screenshots. Images need the login token, so this fetches
// the file and shows it from a blob: URL.
export function Screenshot({ api, token, studentId, takenAt, alt, className }) {
  const [loaded, setLoaded] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.proctorScreenshot(token, studentId, takenAt).then(
      (blob) => !cancelled && setLoaded({ takenAt, url: URL.createObjectURL(blob) }),
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [api, token, studentId, takenAt])

  // Free each picture once a newer one is showing, or when this goes away.
  useEffect(() => () => loaded && URL.revokeObjectURL(loaded.url), [loaded])

  // The previous picture stays up until the new one has arrived, so it doesn't flash.
  if (!loaded) return <div className={`${className} screenshot-empty`} aria-hidden="true" />
  return <img className={className} src={loaded.url} alt={alt} />
}
