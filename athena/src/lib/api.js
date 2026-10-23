// Set VITE_API_URL at build time to use a deployed server (see .env.production).
export function resolveApiUrl(env) {
  return (env?.VITE_API_URL || 'http://localhost:4747').replace(/\/+$/, '')
}

export const API_URL = resolveApiUrl(import.meta.env)

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function createApi(baseUrl = API_URL, fetchImpl = (...args) => fetch(...args)) {
  // `as: 'blob'` returns the response as a Blob (an image) instead of JSON.
  async function call(path, { method = 'GET', token, body, as } = {}) {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    // A Blob (an image) is sent as it is; anything else as JSON.
    const raw = body instanceof Blob
    if (body !== undefined) headers['Content-Type'] = raw ? body.type : 'application/json'

    let res
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined || raw ? body : JSON.stringify(body),
      })
    } catch {
      throw new ApiError('Cannot reach the exam server. Is it running?', 0)
    }

    if (res.ok && as === 'blob') return res.blob()
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(data?.error ?? 'Request failed', res.status)
    return data
  }

  // The calls about one test: taking it at `prefix` (/api for the exam,
  // /api/tests/<id> for any test) and, for proctors, watching it (?test=<id>).
  function testCalls(prefix, testId) {
    const proctor = (path) => `/api/proctor${path}${testId ? `?test=${encodeURIComponent(testId)}` : ''}`
    const calls = {
      getExam: (token) => call(`${prefix}/exam`, { token }),
      getTest: (token) => call(`${prefix}/test`, { token }),
      saveAttempt: (token, { answers, marked }) =>
        call(`${prefix}/attempt`, { method: 'PUT', token, body: { answers, marked } }),
      getResult: (token) => call(`${prefix}/result`, { token }),
      retake: (token) => call(`${prefix}/retake`, { method: 'POST', token }),
      reportAway: (token, away) => call(`${prefix}/away`, { method: 'POST', token, body: { away } }),
      uploadScreen: (token, jpeg) => call(`${prefix}/screen`, { method: 'POST', token, body: jpeg }),
      proctorStudents: (token) => call(proctor('/students'), { token }),
      proctorScreens: (token, studentId) => call(proctor(`/students/${studentId}/screens`), { token }),
      proctorScreenshot: (token, studentId, takenAt) =>
        call(proctor(`/students/${studentId}/screens/${takenAt}`), { token, as: 'blob' }),
      async submit(token, answers) {
        try {
          return await call(`${prefix}/submit`, { method: 'POST', token, body: { answers } })
        } catch (err) {
          // Already submitted (e.g. auto-submit raced a click): show the saved result.
          if (err instanceof ApiError && err.status === 409) return calls.getResult(token)
          throw err
        }
      },
    }
    return calls
  }

  const api = {
    login: (email, password) => call('/api/login', { method: 'POST', body: { email, password } }),
    signup: (name, email, password) =>
      call('/api/signup', { method: 'POST', body: { name, email, password } }),
    getTests: (token) => call('/api/tests', { token }),
    proctorTests: (token) => call('/api/proctor/tests', { token }),
    // Without forTest, the test calls are about the exam.
    ...testCalls('/api'),
    forTest: (testId) => ({ ...api, ...testCalls(`/api/tests/${encodeURIComponent(testId)}`, testId) }),
  }
  return api
}
