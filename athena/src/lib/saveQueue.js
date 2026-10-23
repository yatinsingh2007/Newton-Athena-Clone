// Saves run one at a time and always send the newest state, so a slow request
// can never overwrite a later answer. The chain never rejects: one failure must
// not stop later saves.
export function createSaveQueue({ save, onSaved = () => {}, onError = () => {} }) {
  let latest
  let chain = Promise.resolve()

  const run = async () => {
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
      chain = chain.then(run)
    },
    // Resolves once every queued save has finished.
    flush: () => chain,
  }
}
