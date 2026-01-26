import { describe, it, expect, vi } from 'vitest';
import { createLibrarianMCPServer } from '../server.js';

describe('MCP list verification plans tool', () => {
  it('returns verification plans with optional limit', async () => {
    const server = await createLibrarianMCPServer({
      authorization: {
        enabledScopes: ['read'],
        requireConsent: false,
      },
    });

    const workspace = '/tmp/workspace';
    const mockLibrarian: any = {
      listVerificationPlans: vi.fn().mockResolvedValue([
        { id: 'vp-1' },
        { id: 'vp-2' },
      ]),
    };

    server.registerWorkspace(workspace);
    server.updateWorkspaceState(workspace, { librarian: mockLibrarian, indexState: 'ready' });

    const result = await (server as unknown as { executeListVerificationPlans: (input: { workspace?: string; limit?: number }) => Promise<any> })
      .executeListVerificationPlans({ workspace, limit: 1 });

    expect(result.success).toBe(true);
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.id).toBe('vp-1');
  });
});
