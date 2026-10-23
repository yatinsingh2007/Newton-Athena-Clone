import { useCallback } from 'react'
import { examPhase } from '../lib/timer.js'
import { useServerClock } from './useServerClock.js'

// One test's schedule and a live server clock, re-synced every RESYNC_MS.
// `clock` is null until the server has answered once; `error` is the last failure.
export function useExamClock(api, token) {
  const load = useCallback(() => api.getExam(token), [api, token])
  const { data, now, error } = useServerClock(load)
  if (!data) return { clock: null, error }
  return { clock: { exam: data, now, phase: examPhase(data, now) }, error }
}
