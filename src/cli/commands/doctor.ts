/**
 * @fileoverview Doctor Command - Health Diagnostic Tool
 *
 * Provides comprehensive health diagnostics for the Librarian system.
 * Checks database, embeddings, packs, vector index, graph edges, and bootstrap status.
 *
 * Usage: librarian doctor [--verbose] [--json]
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveDbPath } from '../db_path.js';
import { createSqliteStorage } from '../../storage/sqlite_storage.js';
import { isBootstrapRequired, getBootstrapStatus } from '../../api/bootstrap.js';
import { checkAllProviders } from '../../api/provider_check.js';
import { LIBRARIAN_VERSION } from '../../index.js';
import { printKeyValue, formatBytes } from '../progress.js';

// ============================================================================
// TYPES
// ============================================================================

export type CheckStatus = 'OK' | 'WARNING' | 'ERROR';

export interface DiagnosticCheck {
  name: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
  suggestion?: string;
}

export interface DoctorReport {
  timestamp: string;
  version: string;
  workspace: string;
  overallStatus: CheckStatus;
  checks: DiagnosticCheck[];
  summary: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
  };
}

export interface DoctorCommandOptions {
  workspace: string;
  verbose?: boolean;
  json?: boolean;
}

// ============================================================================
// DIAGNOSTIC CHECKS
// ============================================================================

/**
 * Check 1: Database exists and is accessible
 */
async function checkDatabase(
  workspace: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Database Access',
    status: 'OK',
    message: '',
  };

  try {
    const dbPath = await resolveDbPath(workspace);

    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      check.status = 'ERROR';
      check.message = 'Database file does not exist';
      check.suggestion = 'Run `librarian bootstrap` to initialize the database';
      return check;
    }

    // Check if we can read the file
    const stats = fs.statSync(dbPath);
    check.details = {
      path: dbPath,
      sizeBytes: stats.size,
      sizeFormatted: formatBytes(stats.size),
      lastModified: stats.mtime.toISOString(),
    };

    // Try to open and query the database
    const storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();

    // Quick health check - can we query?
    const metadata = await storage.getMetadata();
    await storage.close();

    if (metadata) {
      check.message = `Database accessible (${formatBytes(stats.size)})`;
      check.details.version = metadata.version.string;
      check.details.qualityTier = metadata.qualityTier;
    } else {
      check.status = 'WARNING';
      check.message = 'Database exists but has no metadata';
      check.suggestion = 'Run `librarian bootstrap` to initialize properly';
    }

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Database error: ${error instanceof Error ? error.message : String(error)}`;
    check.suggestion = 'Check file permissions or run `librarian bootstrap --force`';
    return check;
  }
}

/**
 * Check 2: Functions count vs embeddings count
 */
async function checkFunctionsVsEmbeddings(
  workspace: string,
  dbPath: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Functions/Embeddings Correlation',
    status: 'OK',
    message: '',
  };

  try {
    const storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();

    const stats = await storage.getStats();
    await storage.close();

    const { totalFunctions, totalEmbeddings } = stats;
    check.details = {
      totalFunctions,
      totalEmbeddings,
      ratio: totalFunctions > 0 ? (totalEmbeddings / totalFunctions).toFixed(2) : 'N/A',
    };

    if (totalFunctions === 0) {
      check.status = 'WARNING';
      check.message = 'No functions indexed';
      check.suggestion = 'Run `librarian bootstrap` to index codebase';
      return check;
    }

    if (totalEmbeddings === 0) {
      check.status = 'ERROR';
      check.message = `${totalFunctions} functions but 0 embeddings`;
      check.suggestion = 'Embedding model may have failed. Run `librarian bootstrap --force`';
      return check;
    }

    // Calculate coverage percentage
    const coverage = (totalEmbeddings / totalFunctions) * 100;

    if (coverage < 50) {
      check.status = 'WARNING';
      check.message = `Low embedding coverage: ${coverage.toFixed(1)}% (${totalEmbeddings}/${totalFunctions})`;
      check.suggestion = 'Some functions may be missing embeddings. Consider rebootstrapping.';
    } else if (coverage < 80) {
      check.status = 'WARNING';
      check.message = `Partial embedding coverage: ${coverage.toFixed(1)}% (${totalEmbeddings}/${totalFunctions})`;
    } else {
      check.message = `${totalFunctions} functions, ${totalEmbeddings} embeddings (${coverage.toFixed(1)}% coverage)`;
    }

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

/**
 * Check 3: Packs count vs targetId correlation
 */
async function checkPacksCorrelation(
  workspace: string,
  dbPath: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Context Packs Health',
    status: 'OK',
    message: '',
  };

  try {
    const storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();

    const stats = await storage.getStats();
    const packs = await storage.getContextPacks({ limit: 1000 });
    await storage.close();

    const totalPacks = stats.totalContextPacks;
    const invalidatedPacks = packs.filter(p => p.confidence < 0.1).length;
    const packTypes = new Map<string, number>();

    for (const pack of packs) {
      const type = pack.packType;
      packTypes.set(type, (packTypes.get(type) || 0) + 1);
    }

    check.details = {
      totalPacks,
      invalidatedPacks,
      packTypes: Object.fromEntries(packTypes),
    };

    if (totalPacks === 0) {
      check.status = 'WARNING';
      check.message = 'No context packs generated';
      check.suggestion = 'Run `librarian bootstrap` to generate context packs';
      return check;
    }

    const validRatio = (totalPacks - invalidatedPacks) / totalPacks;

    if (validRatio < 0.5) {
      check.status = 'WARNING';
      check.message = `Many low-confidence packs: ${invalidatedPacks}/${totalPacks} (${((1 - validRatio) * 100).toFixed(1)}%)`;
      check.suggestion = 'Consider reindexing to refresh stale packs';
    } else {
      check.message = `${totalPacks} context packs (${packTypes.size} types)`;
    }

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

/**
 * Check 4: Vector index size (embeddings vs index entries)
 */
async function checkVectorIndex(
  workspace: string,
  dbPath: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Vector Index',
    status: 'OK',
    message: '',
  };

  try {
    const storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();

    const stats = await storage.getStats();

    // Try to get multi-vector records which indicate HNSW index population
    const multiVectors = await storage.getMultiVectors({ limit: 1 });
    await storage.close();

    const { totalEmbeddings } = stats;
    const hasMultiVectors = multiVectors.length > 0;

    check.details = {
      totalEmbeddings,
      hasMultiVectors,
    };

    if (totalEmbeddings === 0) {
      check.status = 'ERROR';
      check.message = 'Vector index is empty (no embeddings)';
      check.suggestion = 'Run `librarian bootstrap` to generate embeddings';
      return check;
    }

    if (!hasMultiVectors && totalEmbeddings > 0) {
      check.status = 'WARNING';
      check.message = `${totalEmbeddings} embeddings but no multi-vectors`;
      check.suggestion = 'Multi-vector indexing may have failed';
    } else {
      check.message = `Vector index populated with ${totalEmbeddings} embeddings`;
    }

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

/**
 * Check 5: Graph edges count
 */
async function checkGraphEdges(
  workspace: string,
  dbPath: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Graph Edges',
    status: 'OK',
    message: '',
  };

  try {
    const storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();

    const edges = await storage.getGraphEdges({ limit: 10000 });
    const stats = await storage.getStats();
    await storage.close();

    const edgeCount = edges.length;
    const edgeTypes = new Map<string, number>();

    for (const edge of edges) {
      const type = edge.edgeType;
      edgeTypes.set(type, (edgeTypes.get(type) || 0) + 1);
    }

    check.details = {
      totalEdges: edgeCount,
      edgeTypes: Object.fromEntries(edgeTypes),
      totalFunctions: stats.totalFunctions,
    };

    if (edgeCount === 0 && stats.totalFunctions > 0) {
      check.status = 'WARNING';
      check.message = 'No graph edges but functions exist';
      check.suggestion = 'Graph building may have failed. Consider rebootstrapping.';
      return check;
    }

    if (edgeCount === 0) {
      check.status = 'WARNING';
      check.message = 'No graph edges (codebase may not have dependencies)';
      return check;
    }

    // Calculate edge density
    const density = stats.totalFunctions > 0
      ? (edgeCount / stats.totalFunctions).toFixed(2)
      : 'N/A';

    check.message = `${edgeCount} graph edges (${edgeTypes.size} types, ~${density} per function)`;

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

/**
 * Check 6: Bootstrap status
 */
async function checkBootstrapStatus(
  workspace: string,
  dbPath: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Bootstrap Status',
    status: 'OK',
    message: '',
  };

  try {
    const storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();

    const [mvpCheck, fullCheck, lastBootstrap] = await Promise.all([
      isBootstrapRequired(workspace, storage, { targetQualityTier: 'mvp' }),
      isBootstrapRequired(workspace, storage, { targetQualityTier: 'full' }),
      storage.getLastBootstrapReport(),
    ]);

    const bootstrapState = getBootstrapStatus(workspace);
    await storage.close();

    check.details = {
      mvpRequired: mvpCheck.required,
      mvpReason: mvpCheck.reason,
      fullRequired: fullCheck.required,
      fullReason: fullCheck.reason,
      lastBootstrapSuccess: lastBootstrap?.success ?? null,
      lastBootstrapError: lastBootstrap?.error ?? null,
      currentStatus: bootstrapState.status,
    };

    if (!lastBootstrap) {
      check.status = 'ERROR';
      check.message = 'Never bootstrapped';
      check.suggestion = 'Run `librarian bootstrap` to initialize the index';
      return check;
    }

    if (!lastBootstrap.success) {
      check.status = 'ERROR';
      check.message = `Last bootstrap failed: ${lastBootstrap.error || 'unknown error'}`;
      check.suggestion = 'Run `librarian bootstrap --force` to retry';
      return check;
    }

    if (mvpCheck.required) {
      check.status = 'WARNING';
      check.message = `Bootstrap outdated: ${mvpCheck.reason}`;
      check.suggestion = 'Run `librarian bootstrap` to refresh';
      return check;
    }

    check.message = 'Bootstrap complete and up-to-date';

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

/**
 * Check 7: Embedding provider availability
 */
async function checkEmbeddingProvider(
  workspace: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Embedding Provider',
    status: 'OK',
    message: '',
  };

  try {
    const providers = await checkAllProviders({ workspaceRoot: workspace });

    check.details = {
      available: providers.embedding.available,
      provider: providers.embedding.provider,
      error: providers.embedding.error ?? null,
    };

    if (!providers.embedding.available) {
      check.status = 'ERROR';
      check.message = `Embedding provider unavailable: ${providers.embedding.error || 'unknown'}`;
      check.suggestion = 'Check embedding provider installation or run `librarian check-providers`';
      return check;
    }

    check.message = `Embedding provider ready (${providers.embedding.provider})`;

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

/**
 * Check 8: LLM provider availability
 */
async function checkLLMProvider(
  workspace: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'LLM Provider',
    status: 'OK',
    message: '',
  };

  try {
    const providers = await checkAllProviders({ workspaceRoot: workspace });

    check.details = {
      available: providers.llm.available,
      provider: providers.llm.provider,
      model: providers.llm.model,
      error: providers.llm.error ?? null,
    };

    if (!providers.llm.available) {
      check.status = 'WARNING';
      check.message = `LLM provider unavailable: ${providers.llm.error || 'unknown'}`;
      check.suggestion = 'Run `claude` or `codex login` to authenticate';
      return check;
    }

    check.message = `LLM provider ready (${providers.llm.provider}: ${providers.llm.model})`;

    return check;
  } catch (error) {
    check.status = 'WARNING';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

/**
 * Check 9: Modules indexed
 */
async function checkModules(
  workspace: string,
  dbPath: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Modules Indexed',
    status: 'OK',
    message: '',
  };

  try {
    const storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();

    const stats = await storage.getStats();
    await storage.close();

    check.details = {
      totalModules: stats.totalModules,
      totalFunctions: stats.totalFunctions,
    };

    if (stats.totalModules === 0 && stats.totalFunctions > 0) {
      check.status = 'WARNING';
      check.message = 'No modules indexed but functions exist';
      check.suggestion = 'Module extraction may have failed';
      return check;
    }

    if (stats.totalModules === 0) {
      check.status = 'WARNING';
      check.message = 'No modules indexed';
      check.suggestion = 'Run `librarian bootstrap` to index codebase';
      return check;
    }

    check.message = `${stats.totalModules} modules indexed`;

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

/**
 * Check 10: Average confidence level
 */
async function checkConfidenceLevel(
  workspace: string,
  dbPath: string
): Promise<DiagnosticCheck> {
  const check: DiagnosticCheck = {
    name: 'Knowledge Confidence',
    status: 'OK',
    message: '',
  };

  try {
    const storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();

    const stats = await storage.getStats();
    await storage.close();

    const avgConfidence = stats.averageConfidence;

    check.details = {
      averageConfidence: avgConfidence.toFixed(3),
    };

    if (avgConfidence < 0.3) {
      check.status = 'ERROR';
      check.message = `Very low average confidence: ${(avgConfidence * 100).toFixed(1)}%`;
      check.suggestion = 'Knowledge quality is poor. Consider rebootstrapping.';
      return check;
    }

    if (avgConfidence < 0.5) {
      check.status = 'WARNING';
      check.message = `Low average confidence: ${(avgConfidence * 100).toFixed(1)}%`;
      check.suggestion = 'Some knowledge may be unreliable';
      return check;
    }

    check.message = `Average confidence: ${(avgConfidence * 100).toFixed(1)}%`;

    return check;
  } catch (error) {
    check.status = 'ERROR';
    check.message = `Failed to check: ${error instanceof Error ? error.message : String(error)}`;
    return check;
  }
}

// ============================================================================
// MAIN DOCTOR COMMAND
// ============================================================================

export async function doctorCommand(options: DoctorCommandOptions): Promise<void> {
  const { workspace, verbose = false, json = false } = options;

  const report: DoctorReport = {
    timestamp: new Date().toISOString(),
    version: LIBRARIAN_VERSION.string,
    workspace,
    overallStatus: 'OK',
    checks: [],
    summary: {
      total: 0,
      ok: 0,
      warnings: 0,
      errors: 0,
    },
  };

  // Resolve database path early for checks that need it
  let dbPath: string;
  try {
    dbPath = await resolveDbPath(workspace);
  } catch (error) {
    const check: DiagnosticCheck = {
      name: 'Database Path Resolution',
      status: 'ERROR',
      message: `Failed to resolve database path: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Check workspace directory permissions',
    };
    report.checks.push(check);
    report.summary.total = 1;
    report.summary.errors = 1;
    report.overallStatus = 'ERROR';

    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      outputTextReport(report, verbose);
    }
    process.exitCode = 1;
    return;
  }

  // Run all diagnostic checks
  const checks = await Promise.all([
    checkDatabase(workspace),
    checkBootstrapStatus(workspace, dbPath),
    checkFunctionsVsEmbeddings(workspace, dbPath),
    checkModules(workspace, dbPath),
    checkPacksCorrelation(workspace, dbPath),
    checkVectorIndex(workspace, dbPath),
    checkGraphEdges(workspace, dbPath),
    checkConfidenceLevel(workspace, dbPath),
    checkEmbeddingProvider(workspace),
    checkLLMProvider(workspace),
  ]);

  report.checks = checks;

  // Calculate summary
  for (const check of checks) {
    report.summary.total++;
    switch (check.status) {
      case 'OK':
        report.summary.ok++;
        break;
      case 'WARNING':
        report.summary.warnings++;
        break;
      case 'ERROR':
        report.summary.errors++;
        break;
    }
  }

  // Determine overall status
  if (report.summary.errors > 0) {
    report.overallStatus = 'ERROR';
  } else if (report.summary.warnings > 0) {
    report.overallStatus = 'WARNING';
  }

  // Output report
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    outputTextReport(report, verbose);
  }

  // Set exit code based on overall status
  if (report.overallStatus === 'ERROR') {
    process.exitCode = 1;
  }
}

/**
 * Output report in human-readable text format
 */
function outputTextReport(report: DoctorReport, verbose: boolean): void {
  const statusIcons: Record<CheckStatus, string> = {
    OK: '[OK]',
    WARNING: '[WARN]',
    ERROR: '[ERROR]',
  };

  console.log('\nLibrarian Doctor - Health Diagnostic Report');
  console.log('============================================\n');

  printKeyValue([
    { key: 'Version', value: report.version },
    { key: 'Workspace', value: report.workspace },
    { key: 'Timestamp', value: report.timestamp },
  ]);
  console.log();

  // Display each check
  console.log('Diagnostic Checks:');
  console.log('------------------\n');

  for (const check of report.checks) {
    const icon = statusIcons[check.status];
    const padding = check.status === 'OK' ? '   ' : (check.status === 'WARNING' ? '' : '');
    console.log(`${icon}${padding} ${check.name}`);
    console.log(`       ${check.message}`);

    if (check.suggestion) {
      console.log(`       Suggestion: ${check.suggestion}`);
    }

    if (verbose && check.details) {
      console.log('       Details:');
      for (const [key, value] of Object.entries(check.details)) {
        const displayValue = typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
        console.log(`         ${key}: ${displayValue}`);
      }
    }
    console.log();
  }

  // Display summary
  console.log('Summary:');
  console.log('--------');
  console.log(`  Total checks: ${report.summary.total}`);
  console.log(`  OK: ${report.summary.ok}`);
  console.log(`  Warnings: ${report.summary.warnings}`);
  console.log(`  Errors: ${report.summary.errors}`);
  console.log();

  // Display overall status
  const overallIcon = statusIcons[report.overallStatus];
  console.log(`Overall Status: ${overallIcon} ${report.overallStatus}`);

  if (report.overallStatus === 'ERROR') {
    console.log('\nAction Required: Address the errors above before using Librarian.');
  } else if (report.overallStatus === 'WARNING') {
    console.log('\nNote: Librarian is functional but may have degraded performance.');
  } else {
    console.log('\nLibrarian is healthy and ready to use.');
  }
  console.log();
}
