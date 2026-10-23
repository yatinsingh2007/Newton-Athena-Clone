// Splits "use `code` here" into text and code segments for rendering.
export function splitInlineCode(text) {
  const segments = []
  const pattern = /`([^`]+)`/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) })
    segments.push({ type: 'code', value: match[1] })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) })
  return segments
}
