import { describe, expect, it } from 'vitest'
import { parsePauseEvent } from './pause-watcher'

describe('parsePauseEvent', () => {
  it('reads the paused flag from a pauseChanged envelope', () => {
    const data = JSON.stringify({ type: 'pauseChanged', data: JSON.stringify({ paused: true }) })
    expect(parsePauseEvent(`event:message\ndata:${data}`)).toBe(true)
  })

  it('ignores other event types and malformed data', () => {
    const data = JSON.stringify({ type: 'modelStatus', data: '[]' })
    expect(parsePauseEvent(`event:message\ndata:${data}`)).toBeNull()
    expect(parsePauseEvent('event:message\ndata:{not json')).toBeNull()
    expect(parsePauseEvent(': keepalive')).toBeNull()
  })
})
