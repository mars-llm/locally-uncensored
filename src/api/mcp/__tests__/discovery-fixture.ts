/** A current-protocol server. It deliberately has no initialize handler. */
export const DISCOVERY = {
  supportedVersions: ['2026-07-28'],
  capabilities: { tools: {} },
  _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'test-server', version: '1.0.0' } },
  resultType: 'complete',
}
