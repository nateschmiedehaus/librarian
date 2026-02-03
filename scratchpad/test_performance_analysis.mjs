/**
 * Test script for Librarian's Performance Analysis
 *
 * Tests the analyzePerformance function on real source files
 * to evaluate detection quality
 */

import { analyzePerformance, findNPlusOne, findBlockingIO, findMemoryLeakRisks, findInefficientLoops, findExpensiveOperations, findSyncInAsync, findLargeBundleImports } from '../dist/api/performance_analysis.js';
import path from 'node:path';
import fs from 'node:fs/promises';

const projectRoot = '/Volumes/BigSSD4/nathanielschmiedehaus/Documents/software/librarian';

// Files to analyze
const testFiles = [
  'src/api/query.ts',
  'src/storage/sqlite_storage.ts',
];

// Mock storage for the test (just needs getFunctionsByPath)
const mockStorage = {
  async getFunctionsByPath(filePath) {
    // Return empty array - will trigger fallback to regex parsing
    return [];
  }
};

async function main() {
  console.log('='.repeat(80));
  console.log('LIBRARIAN PERFORMANCE ANALYSIS - REAL FILE TEST');
  console.log('='.repeat(80));
  console.log();

  for (const relPath of testFiles) {
    const fullPath = path.join(projectRoot, relPath);
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Analyzing: ${relPath}`);
    console.log('─'.repeat(70));

    try {
      const result = await analyzePerformance(mockStorage, fullPath);

      console.log(`\nOverall Risk: ${result.overallRisk.toUpperCase()}`);
      console.log(`Issues Found: ${result.issues.length}`);
      console.log(`Hotspots Found: ${result.hotspots.length}`);
      console.log(`Optimizations Suggested: ${result.optimizations.length}`);
      console.log(`Lines Analyzed: ${result.metadata.linesAnalyzed}`);
      console.log(`Analysis Time: ${result.metadata.analysisTimeMs}ms`);

      // Group issues by type
      const byType = {};
      for (const issue of result.issues) {
        byType[issue.type] = (byType[issue.type] || 0) + 1;
      }

      console.log('\nIssues by Type:');
      for (const [type, count] of Object.entries(byType)) {
        console.log(`  ${type}: ${count}`);
      }

      // Show detailed issues
      if (result.issues.length > 0) {
        console.log('\nDetailed Issues:');
        for (const issue of result.issues.slice(0, 15)) { // Limit to first 15
          console.log(`\n  [${issue.severity.toUpperCase()}] ${issue.type} (line ${issue.line})`);
          console.log(`    Description: ${issue.description}`);
          console.log(`    Code: ${issue.code.slice(0, 60)}${issue.code.length > 60 ? '...' : ''}`);
          console.log(`    Impact: ${issue.impact}`);
          console.log(`    Fix: ${issue.fix}`);
        }
        if (result.issues.length > 15) {
          console.log(`\n  ... and ${result.issues.length - 15} more issues`);
        }
      }

      // Show hotspots
      if (result.hotspots.length > 0) {
        console.log('\nHotspots (Complex Functions):');
        for (const hotspot of result.hotspots.slice(0, 5)) {
          console.log(`  - ${hotspot.function} (line ${hotspot.line}): complexity ${hotspot.complexity}, cost ${hotspot.estimatedCost}`);
        }
      }

      // Show optimization suggestions
      if (result.optimizations.length > 0) {
        console.log('\nOptimization Suggestions:');
        for (const opt of result.optimizations) {
          console.log(`  [${opt.impact.toUpperCase()} impact, ${opt.effort} effort] ${opt.type}`);
          console.log(`    ${opt.description}`);
        }
      }

    } catch (error) {
      console.error(`Error analyzing ${relPath}: ${error.message}`);
    }
  }

  // Now let's also manually validate findings
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION: Checking if detected issues are REAL');
  console.log('='.repeat(80));

  // Read and manually check specific files
  for (const relPath of testFiles) {
    const fullPath = path.join(projectRoot, relPath);
    const content = await fs.readFile(fullPath, 'utf-8');

    console.log(`\nValidating findings in: ${relPath}`);

    // Check for actual sync fs operations
    const syncOps = ['readFileSync', 'writeFileSync', 'existsSync', 'readdirSync', 'statSync'];
    for (const op of syncOps) {
      const regex = new RegExp(`\\b${op}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        console.log(`  Found ${matches.length} occurrence(s) of ${op} - this IS a real sync I/O usage`);
      }
    }

    // Check for actual async loops
    const forAwaitPattern = /for\s*\([^)]*\)\s*\{[\s\S]{0,200}await\s+/g;
    const forAwaitMatches = content.match(forAwaitPattern);
    if (forAwaitMatches) {
      console.log(`  Found ${forAwaitMatches.length} potential N+1 patterns (for-await)`);
    }

    const mapAsyncPattern = /\.map\(\s*async\s*[\w(]/g;
    const mapAsyncMatches = content.match(mapAsyncPattern);
    if (mapAsyncMatches) {
      console.log(`  Found ${mapAsyncMatches.length} potential N+1 patterns (.map(async))`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
