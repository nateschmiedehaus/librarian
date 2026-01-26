import { describe, it, expect, vi } from 'vitest';
import { createLibrarianMCPServer } from '../server.js';

describe('MCP list episodes tool', () => {
  it('returns episodes with optional limit', async () => {
    const server = await createLibrarianMCPServer({
      authorization: {
        enabledScopes: ['read'],
        requireConsent: false,
      },
    });

    const workspace = '/tmp/workspace';
    const mockLibrarian: any = {
      listEpisodes: vi.fn().mockResolvedValue([
        { id: 'ep-1' },
        { id: 'ep-2' },
      ]),
    };

    server.registerWorkspace(workspace);
    server.updateWorkspaceState(workspace, { librarian: mockLibrarian, indexState: 'ready' });

    const result = await (server as unknown as { executeListEpisodes: (input: { workspace?: string; limit?: number }) => Promise<any> })
      .executeListEpisodes({ workspace, limit: 1 });

    expect(result.success).toBe(true);
    expect(result.episodes).toHaveLength(1);
    expect(result.episodes[0]?.id).toBe('ep-1');
  });
});
