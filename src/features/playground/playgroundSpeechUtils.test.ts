import { expect, it } from 'vitest'
import { buildSpeechFilename } from './playgroundSpeechUtils'

it('uses the generated audio type for download filenames', () => {
  expect(buildSpeechFilename('Hello', 0, 'data:audio/wav;base64,AA==')).toMatch(/\.wav$/)
  expect(buildSpeechFilename('Hello', 0, 'data:audio/mpeg;base64,AA==')).toMatch(/\.mp3$/)
})
