export type CliBinaryHashManifest = Readonly<{
  requireHashVerification: boolean;
  hashes: Readonly<{
    claude: readonly string[];
    codex: readonly string[];
  }>;
}>;

export const CLI_BINARY_HASHES: CliBinaryHashManifest = Object.freeze({
  // In production builds this is enforced regardless of this flag.
  requireHashVerification: false,
  hashes: Object.freeze({
    claude: Object.freeze([]),
    codex: Object.freeze([]),
  }),
});
