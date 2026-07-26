import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './clipboard.ts'

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyToClipboard('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    const execCommand = vi.fn().mockReturnValue(true)
    const removeChild = vi.fn()
    const appendChild = vi.fn()
    const ta = {
      value: '',
      setAttribute: vi.fn(),
      style: {} as CSSStyleDeclaration,
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
    }

    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ta),
      execCommand,
      body: { appendChild, removeChild },
    })

    await expect(copyToClipboard('fallback')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('fallback')
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(appendChild).toHaveBeenCalledWith(ta)
    expect(removeChild).toHaveBeenCalledWith(ta)
  })

  it('falls back when clipboard API is missing', async () => {
    const execCommand = vi.fn().mockReturnValue(true)
    const ta = {
      value: '',
      setAttribute: vi.fn(),
      style: {} as CSSStyleDeclaration,
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
    }

    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ta),
      execCommand,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    })

    await expect(copyToClipboard('legacy')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})
