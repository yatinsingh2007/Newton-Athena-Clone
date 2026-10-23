import { readJson } from './store.js'

// Every test students can take, by id, and the file in data/ that holds it,
// in the order the app lists them. `exam` is also what the original
// /api/test, /api/submit, ... routes use. A test with `startsAt` opens to
// everyone at that time; one without can be taken at any time.
export const TEST_FILES = {
  exam: 'questions.json',
  practice: 'practice.json',
}

export const DEFAULT_TEST_ID = 'exam'

export const isTestId = (id) => Object.hasOwn(TEST_FILES, id)

export function loadTest(dataDir, id) {
  return isTestId(id) ? readJson(dataDir, TEST_FILES[id], null) : Promise.resolve(null)
}
