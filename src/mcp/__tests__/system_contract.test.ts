import { describe, it, expect, vi } from 'vitest';
import { createLibrarianMCPServer } from '../server.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('MCP system contract tool', () => {
  it('returns system contract for workspace', async () => {
    const server = await createLibrarianMCPServer({
      authorization: {
        enabledScopes: ['read'],
        requireConsent: false,
      },
    });

    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'librarian-system-contract-'));
    const contract = { sentinel: true };
    const mockLibrarian: any = {
      getSystemContract: vi.fn().mockResolvedValue(contract),
    };

    server.registerWorkspace(workspace);
    server.updateWorkspaceState(workspace, {
      librarian: mockLibrarian,
      indexState: 'ready',
    });

    try {
      // callTool is private; this tests the MCP path including schema validation
      const result = await (server as any).callTool('system_contract', { workspace });
      const payload = JSON.parse(result.content?.[0]?.text ?? '{}');

      expect(payload.success).toBe(true);
      expect(payload.contract).toEqual(contract);
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });
});
