import { Librarian } from '../../api/librarian.js';
import { resolveLibrarianModelConfigWithDiscovery } from '../../api/llm_env.js';

export interface DiagnoseCommandOptions {
  workspace?: string;
  pretty?: boolean;
}

export async function diagnoseCommand(options: DiagnoseCommandOptions): Promise<void> {
  const workspace = options.workspace || process.cwd();
  const pretty = options.pretty ?? false;

  const llmConfig = await resolveLibrarianModelConfigWithDiscovery();
  if (!process.env.LIBRARIAN_LLM_PROVIDER) process.env.LIBRARIAN_LLM_PROVIDER = llmConfig.provider;
  if (!process.env.LIBRARIAN_LLM_MODEL) process.env.LIBRARIAN_LLM_MODEL = llmConfig.modelId;

  const librarian = new Librarian({
    workspace,
    autoBootstrap: false,
    autoWatch: false,
    llmProvider: llmConfig.provider,
    llmModelId: llmConfig.modelId,
  });

  await librarian.initialize();
  const diagnosis = await librarian.diagnoseSelf();
  const output = JSON.stringify(diagnosis, null, pretty ? 2 : 0);
  console.log(output);
  await librarian.shutdown();
}
