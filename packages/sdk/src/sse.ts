/** One server-sent event: its name (`message` when the stream names none) and its data lines joined by newlines. */
export interface ServerSentEvent {
  event: string
  data: string
}

/**
 * The events of a `text/event-stream` body, parsed as the HTML standard's "Server-sent events" section says. Comments
 * (the API's `: connected` and `: heartbeat`) and `id`/`retry` fields are skipped. Cancels the body when the caller
 * stops reading.
 */
export async function* readServerSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = ''
  let data: string[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      // A chunk may end between the CR and LF of one line break, so a trailing CR waits for the next chunk.
      const end = buffer.endsWith('\r') ? buffer.length - 1 : buffer.length
      const lines = buffer.slice(0, end).split(/\r\n|\r|\n/)
      buffer = lines.pop()! + buffer.slice(end)
      for (const line of lines) {
        if (line === '') {
          if (data.length > 0) yield { event: event || 'message', data: data.join('\n') }
          event = ''
          data = []
          continue
        }
        if (line.startsWith(':')) continue
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        const raw = colon === -1 ? '' : line.slice(colon + 1)
        const text = raw.startsWith(' ') ? raw.slice(1) : raw
        if (field === 'event') event = text
        else if (field === 'data') data.push(text)
      }
    }
  } finally {
    await reader.cancel()
  }
}
