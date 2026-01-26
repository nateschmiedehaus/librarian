import { parseArgs } from 'node:util';
import { Librarian } from '../../api/librarian.js';
import { createError } from '../errors.js';

export interface ComposeCommandOptions {
  workspace: string;
  args: string[];
  rawArgs: string[];
}

export async function composeCommand(options: ComposeCommandOptions): Promise<void> {
  const { workspace, rawArgs } = options;

  const { values, positionals } = parseArgs({
    args: rawArgs.slice(1),
    options: {
      limit: { type: 'string' },
      'include-primitives': { type: 'boolean', default: false },
      pretty: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const intent = positionals.join(' ');
  if (!intent) {
    throw createError('INVALID_ARGUMENT', 'Compose intent is required. Usage: librarian compose "<intent>"');
  }

  const includePrimitives = values['include-primitives'] as boolean;
  const pretty = values.pretty as boolean;
  const limitRaw = typeof values.limit === 'string' ? values.limit : '';
  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  if (parsedLimit !== undefined && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
    throw createError('INVALID_ARGUMENT', 'Limit must be a positive integer.');
  }
  const limit = parsedLimit;

  const librarian = new Librarian({
    workspace,
    autoBootstrap: false,
    autoWatch: false,
    llmProvider: (process.env.LIBRARIAN_LLM_PROVIDER as 'claude' | 'codex') || 'claude',
    llmModelId: process.env.LIBRARIAN_LLM_MODEL,
  });

  await librarian.initialize();
  const bundles = await librarian.compileTechniqueBundlesFromIntent(intent, {
    limit,
    includePrimitives,
  });
  const output = JSON.stringify({ intent, bundles }, null, pretty ? 2 : 0);
  console.log(output);
  await librarian.shutdown();
}
