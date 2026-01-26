import type { AuditLogger } from '../mcp/audit.js';
import { toErrorMessage } from '../utils/errors.js';

export interface ToolAdapterContext {
  operation: string;
  input?: Record<string, unknown>;
  sessionId?: string;
  clientId?: string;
  workspace?: string;
}

export interface ToolAdapter {
  call<TOutput>(
    context: ToolAdapterContext,
    execute: () => Promise<TOutput>
  ): Promise<TOutput>;
}

function toAuditOutput(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { value: null };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { value };
  }
  if (Array.isArray(value)) return { items: value };
  if (typeof value === 'object') return value as Record<string, unknown>;
  return { value: String(value) };
}

export class AuditBackedToolAdapter implements ToolAdapter {
  constructor(private audit: AuditLogger) {}

  async call<TOutput>(
    context: ToolAdapterContext,
    execute: () => Promise<TOutput>
  ): Promise<TOutput> {
    const started = Date.now();
    try {
      const result = await execute();
      this.audit.logToolCall({
        operation: context.operation,
        status: 'success',
        sessionId: context.sessionId,
        clientId: context.clientId,
        workspace: context.workspace,
        input: context.input,
        output: toAuditOutput(result),
        durationMs: Date.now() - started,
      });
      await this.audit.flushLedgerWrites();
      return result;
    } catch (error) {
      this.audit.logToolCall({
        operation: context.operation,
        status: 'failure',
        sessionId: context.sessionId,
        clientId: context.clientId,
        workspace: context.workspace,
        input: context.input,
        durationMs: Date.now() - started,
        error: toErrorMessage(error),
      });
      await this.audit.flushLedgerWrites();
      throw error;
    }
  }
}

