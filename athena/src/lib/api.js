export const API_URL = 'http://localhost:4747'

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
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    let res
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
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
    getTest: (token) => call('/api/test', { token }),
    saveAttempt: (token, { answers, marked }) =>
      call('/api/attempt', { method: 'PUT', token, body: { answers, marked } }),
    getResult: (token) => call('/api/result', { token }),
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
