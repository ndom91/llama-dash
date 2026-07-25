import { describe, expect, it } from 'vitest'
import { groupHeaders } from './requestDetailUtils'

const keys = (entries: Array<[string, string]>) => entries.map(([k]) => k)

describe('groupHeaders', () => {
  it('puts priority headers first, in curated order', () => {
    const grouped = groupHeaders([
      ['user-agent', 'curl/8'],
      ['content-type', 'application/json'],
      ['authorization', 'Bearer sk-x'],
    ])
    expect(keys(grouped.primary)).toEqual(['authorization', 'content-type', 'user-agent'])
  })

  it('sorts non-priority headers alphabetically after the priority block', () => {
    const grouped = groupHeaders([
      ['x-zulu', '1'],
      ['content-type', 'application/json'],
      ['x-alpha', '2'],
    ])
    expect(keys(grouped.primary)).toEqual(['content-type', 'x-alpha', 'x-zulu'])
  })

  // The fold problem: eight of these ahead of content-type in serialization
  // order made the pane useless at its 50% max height.
  it('separates browser boilerplate out of the primary list', () => {
    const grouped = groupHeaders([
      ['sec-ch-ua', '"Chromium";v="150"'],
      ['sec-ch-ua-platform', '"macOS"'],
      ['sec-fetch-mode', 'cors'],
      ['accept-language', 'en-US'],
      ['cookie', 'a=b'],
      ['dnt', '1'],
      ['content-type', 'application/json'],
    ])
    expect(keys(grouped.primary)).toEqual(['content-type'])
    expect(keys(grouped.boilerplate)).toEqual([
      'accept-language',
      'cookie',
      'dnt',
      'sec-ch-ua',
      'sec-ch-ua-platform',
      'sec-fetch-mode',
    ])
  })

  it('treats accept as meaningful but accept-encoding as boilerplate', () => {
    const grouped = groupHeaders([
      ['accept-encoding', 'gzip'],
      ['accept', '*/*'],
    ])
    expect(keys(grouped.primary)).toEqual(['accept'])
    expect(keys(grouped.boilerplate)).toEqual(['accept-encoding'])
  })

  it('is case-insensitive when classifying', () => {
    const grouped = groupHeaders([
      ['Content-Type', 'application/json'],
      ['Sec-CH-UA-Platform', '"macOS"'],
    ])
    expect(keys(grouped.primary)).toEqual(['Content-Type'])
    expect(keys(grouped.boilerplate)).toEqual(['Sec-CH-UA-Platform'])
  })

  it('never drops a header', () => {
    const entries: Array<[string, string]> = [
      ['authorization', 'Bearer x'],
      ['sec-ch-ua', 'x'],
      ['x-custom', 'x'],
      ['cookie', 'x'],
    ]
    const grouped = groupHeaders(entries)
    expect(grouped.primary.length + grouped.boilerplate.length).toBe(entries.length)
  })

  it('handles an empty header map', () => {
    expect(groupHeaders([])).toEqual({ primary: [], boilerplate: [] })
  })
})
