export function gradeAnswers(questions, answers) {
  const score = questions.filter((q) => answers[q.id] === q.answerIndex).length
  return { score, total: questions.length }
}
