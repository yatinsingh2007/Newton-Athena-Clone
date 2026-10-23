import { splitInlineCode } from '../lib/inlineCode.js'

export function QuestionText({ text }) {
  return splitInlineCode(text).map((segment, i) =>
    segment.type === 'code' ? (
      <code key={i} className="inline-code">{segment.value}</code>
    ) : (
      <span key={i}>{segment.value}</span>
    ),
  )
}
