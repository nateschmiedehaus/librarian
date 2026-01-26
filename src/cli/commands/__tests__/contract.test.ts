import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { contractCommand } from '../contract.js';
import { Librarian } from '../../../api/librarian.js';

vi.mock('../../../api/librarian.js');

describe('contractCommand', () => {
  const mockWorkspace = '/test/workspace';

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let mockLibrarian: {
    initialize: Mock;
    getSystemContract: Mock;
    shutdown: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockLibrarian = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getSystemContract: vi.fn().mockResolvedValue({ sentinel: true }),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    (Librarian as unknown as Mock).mockImplementation(() => mockLibrarian);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('prints the system contract as JSON', async () => {
    await contractCommand({ workspace: mockWorkspace });

    expect(mockLibrarian.getSystemContract).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"sentinel":true'));
    expect(mockLibrarian.shutdown).toHaveBeenCalled();
  });

  it('prints pretty JSON when requested', async () => {
    await contractCommand({ workspace: mockWorkspace, pretty: true });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('\n  "sentinel": true'));
  });
});
