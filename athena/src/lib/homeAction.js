// What the student can do from the home screen, given the live exam clock:
// 'result', 'wait', 'missed', 'resume' or 'start'.
export function homeAction({ phase, exam }) {
  const { status } = exam.attempt
  if (status === 'submitted') return 'result'
  // Time ran out mid-test: the test screen submits it or shows the graded result.
  if (status === 'in_progress') return 'resume'
  if (phase === 'upcoming') return 'wait'
  if (phase === 'closed') return 'missed'
  return 'start'
}
