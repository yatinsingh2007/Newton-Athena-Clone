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
  async function call(path, { method = 'GET', token, body } = {}) {
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

    const data = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(data?.error ?? 'Request failed', res.status)
    return data
  }

  const api = {
    login: (email, password) => call('/api/login', { method: 'POST', body: { email, password } }),
    signup: (name, email, password) =>
      call('/api/signup', { method: 'POST', body: { name, email, password } }),
    getExam: (token) => call('/api/exam', { token }),
    getTest: (token) => call('/api/test', { token }),
    saveAttempt: (token, { answers, marked }) =>
      call('/api/attempt', { method: 'PUT', token, body: { answers, marked } }),
    getResult: (token) => call('/api/result', { token }),
    retake: (token) => call('/api/retake', { method: 'POST', token }),
    uploadScreen: (token, jpeg) => call('/api/screen', { method: 'POST', token, body: jpeg }),
    async submit(token, answers) {
      try {
        return await call('/api/submit', { method: 'POST', token, body: { answers } })
      } catch (err) {
        // Already submitted (e.g. auto-submit raced a click): show the saved result.
        if (err instanceof ApiError && err.status === 409) return api.getResult(token)
        throw err
      }
    },
  }
  return api
}
