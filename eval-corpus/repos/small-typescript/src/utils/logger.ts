export const logInfo = (message: string, meta?: Record<string, unknown>): void => {
  if (meta) {
    // eslint-disable-next-line no-console
    console.log(`[library] ${message}`, meta);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[library] ${message}`);
};
