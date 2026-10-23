// Saves run one at a time and always send the newest state, so a slow request
// can never overwrite a later answer. While one save runs, any number of new
// changes collapse into a single follow-up save. The chain never rejects: one
// failure must not stop later saves.
export function createSaveQueue({ save, onSaved = () => {}, onError = () => {} }) {
  let latest
  let chain = Promise.resolve()
  let pending = false

  const run = async () => {
    pending = false
    try {
      await save(latest)
      onSaved()
    } catch (err) {
      try {
        await onError(err)
      } catch {
        // The handler's own failure must not break the queue either.
      }
    }
  }

  return {
    enqueue(state) {
      latest = state
      if (pending) return
      pending = true
      chain = chain.then(run)
    },
    // Resolves once every queued save has finished.
    flush: () => chain,
  }
}
