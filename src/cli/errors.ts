/**
 * @fileoverview CLI error handling with helpful suggestions
 */

export class CliError extends Error {
  constructor(
    message: string,
    public readonly code: CliErrorCode,
    public readonly suggestion?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export type CliErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'NOT_BOOTSTRAPPED'
  | 'QUERY_FAILED'
  | 'ENTITY_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'STORAGE_ERROR'
  | 'INVALID_ARGUMENT'
  | 'TIMEOUT'
  | 'PREFLIGHT_FAILED'
  | 'INDEX_FAILED';

export const ERROR_SUGGESTIONS: Record<CliErrorCode, string> = {
  PROVIDER_UNAVAILABLE: 'Run `librarian check-providers` to diagnose provider issues.',
  NOT_BOOTSTRAPPED: 'Run `librarian bootstrap` first to initialize the knowledge index.',
  QUERY_FAILED: 'Try a simpler query or check `librarian status` for index health.',
  ENTITY_NOT_FOUND: 'Run `librarian status` to see available modules and functions.',
  VALIDATION_FAILED: 'Check the file path and ensure it exists in the workspace.',
  STORAGE_ERROR: 'Run `librarian bootstrap --force` to reinitialize the storage.',
  INVALID_ARGUMENT: 'Run `librarian help <command>` for usage information.',
  TIMEOUT: 'The operation timed out. Try again or increase the timeout with --timeout.',
  PREFLIGHT_FAILED: 'Fix the issues listed above before running bootstrap.',
  INDEX_FAILED: 'Check provider availability with `librarian check-providers` and ensure files are valid.',
};

export function createError(
  code: CliErrorCode,
  message: string,
  details?: Record<string, unknown>,
): CliError {
  return new CliError(message, code, ERROR_SUGGESTIONS[code], details);
}

export function formatError(error: unknown): string {
  if (error instanceof CliError) {
    return `Error [${error.code}]: ${error.message}`;
  }
  if (error instanceof Error) {
    // Check for common error patterns and suggest solutions
    const message = error.message;

    if (message.includes('unverified_by_trace(provider_unavailable)')) {
      return `Error: Provider unavailable.\n\nSuggestion: ${ERROR_SUGGESTIONS.PROVIDER_UNAVAILABLE}`;
    }

    if (message.includes('not bootstrapped') || message.includes('No existing librarian data')) {
      return `Error: Librarian not initialized.\n\nSuggestion: ${ERROR_SUGGESTIONS.NOT_BOOTSTRAPPED}`;
    }

    if (message.includes('ENOENT')) {
      return `Error: File or directory not found: ${message}`;
    }

    return `Error: ${message}`;
  }
  return `Error: ${String(error)}`;
}

/**
 * Suggest similar successful queries based on recent query history
 */
export function suggestSimilarQueries(failedQuery: string, _recentQueries: string[]): string[] {
  // Simple keyword-based suggestions
  const keywords = failedQuery.toLowerCase().split(/\s+/);
  const suggestions: string[] = [];

  // Common query patterns
  const patterns = [
    { trigger: 'how', template: 'How does <topic> work?' },
    { trigger: 'what', template: 'What is the purpose of <topic>?' },
    { trigger: 'where', template: 'Where is <topic> defined?' },
    { trigger: 'find', template: 'Find all uses of <topic>' },
    { trigger: 'show', template: 'Show the implementation of <topic>' },
  ];

  for (const pattern of patterns) {
    if (keywords.includes(pattern.trigger)) {
      const topic = keywords.filter((k) => k !== pattern.trigger).join(' ');
      if (topic) {
        suggestions.push(pattern.template.replace('<topic>', topic));
      }
    }
  }

  return suggestions.slice(0, 3);
}
