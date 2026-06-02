const MAX_SPEECH_SEGMENT_CHARS = 1_200

export function splitSpeechIntoSegments(input: string, maxChars = MAX_SPEECH_SEGMENT_CHARS): string[] {
  const paragraphs = input
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => splitLongParagraph(paragraph, maxChars))

  const segments: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph
    if (next.length <= maxChars) {
      current = next
      continue
    }

    if (current) segments.push(current)
    current = paragraph
  }

  if (current) segments.push(current)
  return segments
}

function splitLongParagraph(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph]

  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean)
  const segments: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        segments.push(current)
        current = ''
      }
      segments.push(...splitHard(sentence, maxChars))
      continue
    }

    const next = current ? `${current} ${sentence}` : sentence
    if (next.length <= maxChars) current = next
    else {
      if (current) segments.push(current)
      current = sentence
    }
  }

  if (current) segments.push(current)
  return segments
}

function splitHard(value: string, maxChars: number): string[] {
  const segments: string[] = []
  let remaining = value.trim()

  while (remaining.length > maxChars) {
    const boundary = remaining.lastIndexOf(' ', maxChars)
    const cut = boundary > maxChars * 0.5 ? boundary : maxChars
    segments.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }

  if (remaining) segments.push(remaining)
  return segments
}
