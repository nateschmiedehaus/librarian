type LogContext = Record<string, unknown>;

type LoggerFn = (message: string, context?: LogContext) => void;

const emit = (level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: LogContext): void => {
  // IMPORTANT: This library is used in CLI contexts where stdout is reserved for
  // machine-readable output (e.g. `--json`). Keep all logs on stderr to avoid
  // corrupting JSON output streams.
  const logger = level === 'warn' ? console.warn : console.error;
  if (context && Object.keys(context).length > 0) {
    logger(message, context);
    return;
  }
  logger(message);
};

export const logInfo: LoggerFn = (message, context) => emit('info', message, context);
export const logWarning: LoggerFn = (message, context) => emit('warn', message, context);
export const logError: LoggerFn = (message, context) => emit('error', message, context);
export const logDebug: LoggerFn = (message, context) => emit('debug', message, context);
