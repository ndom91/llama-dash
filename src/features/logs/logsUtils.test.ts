import { describe, expect, it } from 'vitest'
import { parseLogLevel } from './logsUtils'

describe('parseLogLevel', () => {
  describe('llama-swap bracketed levels', () => {
    it('parses and strips the bracketed token', () => {
      expect(parseLogLevel('[INFO] Request 10.0.0.99 "GET /running"')).toEqual({
        level: 'INFO',
        rest: 'Request 10.0.0.99 "GET /running"',
      })
    })

    it('normalises aliases', () => {
      expect(parseLogLevel('[WARNING] x').level).toBe('WARN')
      expect(parseLogLevel('[ERR] x').level).toBe('ERROR')
      expect(parseLogLevel('[FATAL] x').level).toBe('ERROR')
      expect(parseLogLevel('[DBG] x').level).toBe('DEBUG')
      expect(parseLogLevel('[TRC] x').level).toBe('TRACE')
    })

    it('is case-insensitive', () => {
      expect(parseLogLevel('[warn] x').level).toBe('WARN')
    })
  })

  // llama.cpp writes severity as a single letter after its uptime timestamp.
  // Before this was parsed, every such line was labelled a fabricated DEBUG, so
  // a real warning looked identical to trace spam.
  describe('llama.cpp single-letter levels', () => {
    it('parses a warning', () => {
      const line = '4801.04.670.511 W srv          alloc: - making room for prompt cache entry'
      expect(parseLogLevel(line)).toEqual({ level: 'WARN', rest: line })
    })

    it('parses info', () => {
      expect(parseLogLevel('4801.05.003.781 I slot launch_slot_: id  0 | task 701').level).toBe('INFO')
    })

    it('parses error and debug', () => {
      expect(parseLogLevel('4801.58.375.967 E srv    failed').level).toBe('ERROR')
      expect(parseLogLevel('4801.58.375.967 D srv    detail').level).toBe('DEBUG')
    })

    it('leaves the raw line intact', () => {
      const line = '4717.00.291.220 I slot print_timing: id  0 | task 1461'
      expect(parseLogLevel(line).rest).toBe(line)
    })
  })

  describe('lines with no severity marker', () => {
    it('returns null rather than guessing a level', () => {
      expect(parseLogLevel('Request 10.0.0.99 "GET /running HTTP/1.1" 200')).toEqual({
        level: null,
        rest: 'Request 10.0.0.99 "GET /running HTTP/1.1" 200',
      })
    })

    it('does not treat a bare number followed by a word as a level', () => {
      expect(parseLogLevel('some line with 123.456 no letter here').level).toBeNull()
    })

    it('does not match a multi-letter token after a timestamp', () => {
      expect(parseLogLevel('4801.04.670.511 WW srv something').level).toBeNull()
    })

    it('handles an empty line', () => {
      expect(parseLogLevel('')).toEqual({ level: null, rest: '' })
    })
  })
})
