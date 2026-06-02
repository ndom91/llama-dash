import { describe, expect, it } from 'vitest'
import { splitSpeechIntoSegments } from './playground-speech-segments'

describe('splitSpeechIntoSegments', () => {
  it('keeps short paragraphs together up to the limit', () => {
    const segments = splitSpeechIntoSegments('One short paragraph.\n\nAnother short paragraph.', 80)

    expect(segments).toEqual(['One short paragraph.\n\nAnother short paragraph.'])
  })

  it('starts a new segment at paragraph boundaries', () => {
    const segments = splitSpeechIntoSegments(
      'A compact opener.\n\nThis second paragraph should move to another chunk.',
      55,
    )

    expect(segments).toEqual(['A compact opener.', 'This second paragraph should move to another chunk.'])
  })

  it('splits long paragraphs by sentence before hard wrapping', () => {
    const segments = splitSpeechIntoSegments(
      'First sentence is manageable. Second sentence is also manageable. Third sentence is separate.',
      45,
    )

    expect(segments).toEqual([
      'First sentence is manageable.',
      'Second sentence is also manageable.',
      'Third sentence is separate.',
    ])
  })
})
