import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { diagnoseCommand } from '../diagnose.js';
import { Librarian } from '../../../api/librarian.js';
import { resolveLibrarianModelConfigWithDiscovery } from '../../../api/llm_env.js';

vi.mock('../../../api/librarian.js');
vi.mock('../../../api/llm_env.js', () => ({
  resolveLibrarianModelConfigWithDiscovery: vi.fn().mockResolvedValue({
    provider: 'claude',
    modelId: 'claude-sonnet-4-20250514',
  }),
}));

describe('diagnoseCommand', () => {
  const mockWorkspace = '/test/workspace';

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let mockLibrarian: {
    initialize: Mock;
    diagnoseSelf: Mock;
    shutdown: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockLibrarian = {
      initialize: vi.fn().mockResolvedValue(undefined),
      diagnoseSelf: vi.fn().mockResolvedValue({ status: 'ok' }),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    (Librarian as unknown as Mock).mockImplementation(() => mockLibrarian);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('prints the diagnosis as JSON', async () => {
    await diagnoseCommand({ workspace: mockWorkspace });

    expect(mockLibrarian.diagnoseSelf).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"status":"ok"'));
    expect(mockLibrarian.shutdown).toHaveBeenCalled();
  });

  it('prints pretty JSON when requested', async () => {
    await diagnoseCommand({ workspace: mockWorkspace, pretty: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('\n  "status": "ok"'));
  });
});
