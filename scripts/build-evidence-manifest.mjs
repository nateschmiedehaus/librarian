#!/usr/bin/env node
/**
 * @fileoverview Generate a deterministic evidence manifest for evaluation artifacts.
 *
 * Usage:
 *   node scripts/build-evidence-manifest.mjs [--root <path>] [--output <path>]
 */

import { join, resolve, isAbsolute } from 'node:path';

async function loadWriter() {
  try {
    const mod = await import('../dist/evaluation/evidence_manifest.js');
    return mod.writeEvidenceManifest;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load dist build (${message}). Run: npm run build`);
  }
}

function parseArgs(argv) {
  const out = { root: process.cwd(), output: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --root');
      out.root = resolve(value);
      i += 1;
    } else if (arg === '--output') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --output');
      out.output = value;
      i += 1;
    }
  }
  return out;
}

function resolveOutputPath(root, output) {
  if (!output) return undefined;
  return isAbsolute(output) ? output : join(root, output);
}

async function main() {
  const { root, output } = parseArgs(process.argv);
  const outputPath = resolveOutputPath(root, output);
  const writeEvidenceManifest = await loadWriter();
  const result = await writeEvidenceManifest({ workspaceRoot: root, outputPath });
  process.stdout.write(`[evidence-manifest] wrote ${result.outputPath}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[evidence-manifest] failed: ${message}\n`);
  process.exit(1);
});
