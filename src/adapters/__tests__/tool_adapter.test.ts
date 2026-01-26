import { describe, expect, it } from 'vitest';
import { createAuditLogger } from '../../mcp/audit.js';
import { SqliteEvidenceLedger } from '../../epistemics/evidence_ledger.js';
import { AuditBackedToolAdapter } from '../tool_adapter.js';

describe('AuditBackedToolAdapter', () => {
  it('records successful tool calls to the evidence ledger', async () => {
    const ledger = new SqliteEvidenceLedger(':memory:');
    await ledger.initialize();
    const audit = createAuditLogger({ minSeverity: 'debug' }, { ledger });
    const adapter = new AuditBackedToolAdapter(audit);

    const result = await adapter.call(
      { operation: 'demo_tool', input: { hello: 'world' }, sessionId: 'sess_test' },
      async () => ({ ok: true })
    );

    expect(result).toEqual({ ok: true });

    const entries = await ledger.query({ kinds: ['tool_call'] });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.payload).toMatchObject({
      toolName: 'demo_tool',
      success: true,
    });

    await ledger.close();
  });

  it('records failed tool calls to the evidence ledger', async () => {
    const ledger = new SqliteEvidenceLedger(':memory:');
    await ledger.initialize();
    const audit = createAuditLogger({ minSeverity: 'debug' }, { ledger });
    const adapter = new AuditBackedToolAdapter(audit);

    await expect(
      adapter.call(
        { operation: 'demo_tool', input: { fail: true }, sessionId: 'sess_test' },
        async () => {
          throw new Error('boom');
        }
      )
    ).rejects.toThrow('boom');

    const entries = await ledger.query({ kinds: ['tool_call'] });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.payload).toMatchObject({
      toolName: 'demo_tool',
      success: false,
    });

    await ledger.close();
  });
});

