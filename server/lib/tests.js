import { readJson } from './store.js'

// Every test students can take, by id, and the file in data/ that holds it.
// `exam` is also what the original /api/test, /api/submit, ... routes use.
export const TEST_FILES = {
  exam: 'questions.json',
}

export const DEFAULT_TEST_ID = 'exam'

export const isTestId = (id) => Object.hasOwn(TEST_FILES, id)

export function loadTest(dataDir, id) {
  return isTestId(id) ? readJson(dataDir, TEST_FILES[id], null) : Promise.resolve(null)
}
