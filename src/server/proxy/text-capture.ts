export const MAX_CAPTURED_RESPONSE_BYTES = 256 * 1024

export class BoundedTextCapture {
  private chunks: string[] = []
  private bytes = 0
  private truncatedBytes = 0

  constructor(private readonly maxBytes = MAX_CAPTURED_RESPONSE_BYTES) {}

  append(text: string) {
    if (!text) return
    const incomingBytes = Buffer.byteLength(text, 'utf8')
    const remaining = this.maxBytes - this.bytes
    if (remaining <= 0) {
      this.truncatedBytes += incomingBytes
      return
    }
    if (incomingBytes <= remaining) {
      this.chunks.push(text)
      this.bytes += incomingBytes
      return
    }

    let cut = text.slice(0, remaining)
    while (Buffer.byteLength(cut, 'utf8') > remaining) {
      cut = cut.slice(0, -1)
    }
    this.chunks.push(cut)
    const capturedBytes = Buffer.byteLength(cut, 'utf8')
    this.bytes += capturedBytes
    this.truncatedBytes += incomingBytes - capturedBytes
  }

  text(): string | null {
    if (this.chunks.length === 0 && this.truncatedBytes === 0) return null
    const body = this.chunks.join('')
    if (this.truncatedBytes === 0) return body
    return `${body}\n...[truncated ${this.truncatedBytes} bytes]`
  }

  usageText(): string | null {
    return this.truncatedBytes === 0 ? this.chunks.join('') || null : null
  }
}
