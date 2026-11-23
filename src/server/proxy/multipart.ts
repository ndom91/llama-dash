export type MultipartTextField = {
  value: string
  // Byte offsets of the value within the raw body, so it can be replaced in place.
  start: number
  end: number
}

const CRLF = Buffer.from('\r\n')
const HEADER_END = Buffer.from('\r\n\r\n')

// Reads named text fields straight from the raw multipart bytes. Parsing with
// FormData and re-encoding would change the boundary and length, so the
// forwarded body stays byte-identical and only these offsets are recorded.
// Returns null when the body is not well-formed multipart.
export function readMultipartTextFields(
  bytes: Uint8Array,
  contentType: string,
  names: ReadonlySet<string>,
): Map<string, MultipartTextField> | null {
  const boundary = multipartBoundary(contentType)
  if (!boundary) return null

  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const delimiter = Buffer.from(`--${boundary}`)
  const partEnd = Buffer.concat([CRLF, delimiter])
  const fields = new Map<string, MultipartTextField>()

  let cursor = buf.indexOf(delimiter)
  if (cursor === -1) return null

  while (true) {
    const afterDelimiter = cursor + delimiter.length
    const marker = buf.subarray(afterDelimiter, afterDelimiter + 2).toString('latin1')
    if (marker === '--') return fields
    if (marker !== '\r\n') return null

    const headersStart = afterDelimiter + 2
    const headersEnd = buf.indexOf(HEADER_END, afterDelimiter)
    if (headersEnd === -1) return null

    const valueStart = headersEnd + HEADER_END.length
    const valueEnd = buf.indexOf(partEnd, valueStart)
    if (valueEnd === -1) return null

    const name = textFieldName(buf.subarray(headersStart, headersEnd).toString('utf8'))
    if (name && names.has(name) && !fields.has(name)) {
      fields.set(name, {
        value: buf.subarray(valueStart, valueEnd).toString('utf8'),
        start: valueStart,
        end: valueEnd,
      })
    }

    cursor = valueEnd + CRLF.length
  }
}

export function replaceMultipartBytes(bytes: Uint8Array, field: MultipartTextField, value: string): Uint8Array {
  return Buffer.concat([bytes.subarray(0, field.start), Buffer.from(value, 'utf8'), bytes.subarray(field.end)])
}

function multipartBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)
  return match ? (match[1] ?? match[2]) : null
}

// File parts are skipped: a `filename` means the value is upload content.
function textFieldName(headers: string): string | null {
  const disposition = headers.split('\r\n').find((line) => /^content-disposition\s*:/i.test(line))
  if (!disposition || /\bfilename\*?\s*=/i.test(disposition)) return null
  const match = disposition.match(/\bname\s*=\s*(?:"([^"]*)"|([^;\s]+))/i)
  return match ? (match[1] ?? match[2]) : null
}
