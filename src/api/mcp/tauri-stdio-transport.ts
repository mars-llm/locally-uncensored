import { parseJSONRPCMessage, type JSONRPCMessage, type Transport } from '@modelcontextprotocol/client'
import { isRecord, errorText } from '../../types/json-guards'

/** The SDK owns the protocol; Tauri retains ownership of the child process. */
export class TauriStdioTransport implements Transport {
  onmessage?: Transport['onmessage']
  onerror?: Transport['onerror']
  onclose?: Transport['onclose']
  private buffer = ''
  private started = false
  private closed = false

  private readonly write: (line: string) => Promise<void>
  private readonly kill: () => Promise<void>

  constructor(write: (line: string) => Promise<void>, kill: () => Promise<void>) {
    this.write = write
    this.kill = kill
  }

  async start(): Promise<void> {
    if (this.closed) throw new Error('Server process exited')
    this.started = true
    this.receive('')
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed) throw new Error('Server process exited')
    await this.write(JSON.stringify(message) + '\n')
  }

  receive(data: string): void {
    if (this.closed) return
    this.buffer += data
    if (!this.started) return
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let parsed: unknown
      try { parsed = JSON.parse(line) } catch { continue } // Ignore stdout chatter.
      // Preserve LU's error reporting for non-conforming servers. A present
      // error must never turn into a successful tool result.
      if (isRecord(parsed) && parsed.error != null) {
        const raw = parsed.error
        if (!isRecord(raw) || typeof raw.code !== 'number' || typeof raw.message !== 'string') {
          parsed.error = { code: -32603, message: errorText(raw) || 'MCP server reported an error' }
        }
      } else if (isRecord(parsed) && parsed.error === null) {
        delete parsed.error
      }
      try { this.onmessage?.(parseJSONRPCMessage(parsed)) }
      catch (err) { this.onerror?.(err instanceof Error ? err : new Error(String(err))) }
    }
  }

  exited(): void {
    if (this.closed) return
    this.closed = true
    this.buffer = ''
    this.onclose?.()
  }

  async close(): Promise<void> {
    if (this.closed) return
    try { await this.kill() } finally { this.exited() }
  }
}
