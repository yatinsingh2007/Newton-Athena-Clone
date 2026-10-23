export function questionStatus(qid, { answers, marked, visited }) {
  const answered = answers[qid] !== undefined
  if (marked.includes(qid)) return answered ? 'answered-marked' : 'marked'
  if (answered) return 'answered'
  return visited.has(qid) ? 'not-answered' : 'not-visited'
}

export function summarize(questions, answers, marked) {
  return {
    answered: questions.filter((q) => answers[q.id] !== undefined).length,
    marked: questions.filter((q) => marked.includes(q.id)).length,
    total: questions.length,
  }
}
