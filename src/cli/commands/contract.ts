import { Librarian } from '../../api/librarian.js';

export interface ContractCommandOptions {
  workspace?: string;
  pretty?: boolean;
}

export async function contractCommand(options: ContractCommandOptions): Promise<void> {
  const workspace = options.workspace || process.cwd();
  const pretty = options.pretty ?? false;

  const librarian = new Librarian({
    workspace,
    autoBootstrap: false,
    autoWatch: false,
    llmProvider: (process.env.LIBRARIAN_LLM_PROVIDER as 'claude' | 'codex') || 'claude',
    llmModelId: process.env.LIBRARIAN_LLM_MODEL,
  });

  await librarian.initialize();
  const contract = await librarian.getSystemContract();
  const output = JSON.stringify(contract, null, pretty ? 2 : 0);
  console.log(output);
  await librarian.shutdown();
}
