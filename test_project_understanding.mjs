#!/usr/bin/env node
/**
 * Test Script: Evaluate generateProjectUnderstanding on the librarian codebase
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspace = __dirname;

// Import from built dist/
const { generateProjectUnderstanding } = await import('./dist/api/project_understanding.js');
const { createSqliteStorage } = await import('./dist/storage/sqlite_storage.js');

// Ground truth based on actual codebase analysis
const GROUND_TRUTH = {
  name: 'librarian',
  descriptionKeywords: ['knowledge', 'agent', 'code', 'semantic'],
  purposeKeywords: ['cli', 'executable', 'knowledge', 'agent'],
  architectureType: 'cli',
  expectedLayers: ['api', 'storage', 'cli', 'knowledge', 'graphs', 'epistemics', 'constructions'],
  entryPointPatterns: ['cli/index', 'index.js', 'index.ts'],
  primaryLanguage: 'TypeScript',
  languages: ['TypeScript', 'JavaScript'],
  namingStyle: 'camelCase',
  testPattern: 'test.ts',
  importStyle: 'relative',
  configFormat: 'json',
  testFrameworks: ['Vitest'],
};

async function runTest() {
  console.log('='.repeat(70));
  console.log('PROJECT UNDERSTANDING EVALUATION TEST');
  console.log('='.repeat(70));
  console.log('\nWorkspace:', workspace, '\n');

  const indexPath = join(workspace, '.librarian', 'index.db');
  let storage;

  if (fs.existsSync(indexPath)) {
    console.log('Using existing index at:', indexPath);
    storage = createSqliteStorage(indexPath, workspace);
  } else {
    console.log('No existing index, using in-memory storage');
    storage = createSqliteStorage(':memory:', workspace);
  }

  await storage.initialize();
  console.log('\nGenerating project understanding...\n');

  const startTime = Date.now();
  const understanding = await generateProjectUnderstanding({
    workspace,
    storage,
    includeHotspots: false,
    maxFilesForConventions: 50,
  });
  const elapsed = Date.now() - startTime;
  console.log('Generation completed in', elapsed, 'ms\n');
  console.log('-'.repeat(70));

  const results = { accurate: [], inaccurate: [], partial: [] };

  // PROJECT IDENTITY
  console.log('\n### PROJECT IDENTITY\n');

  if (understanding.name === GROUND_TRUTH.name) {
    results.accurate.push('Project name');
    console.log('[PASS] Name:', understanding.name);
  } else {
    results.inaccurate.push('Name: expected ' + GROUND_TRUTH.name + ', got ' + understanding.name);
    console.log('[FAIL] Name: expected', GROUND_TRUTH.name, 'got', understanding.name);
  }

  const descHasKeywords = GROUND_TRUTH.descriptionKeywords.some(kw =>
    understanding.description.toLowerCase().includes(kw)
  );
  if (descHasKeywords) {
    results.accurate.push('Description contains expected keywords');
    console.log('[PASS] Description:', understanding.description.substring(0, 80) + '...');
  } else {
    results.partial.push('Description missing expected keywords');
    console.log('[PARTIAL] Description:', understanding.description.substring(0, 80) + '...');
  }

  const purposeHasKeywords = GROUND_TRUTH.purposeKeywords.some(kw =>
    understanding.purpose.toLowerCase().includes(kw)
  );
  if (purposeHasKeywords) {
    results.accurate.push('Purpose contains expected keywords');
    console.log('[PASS] Purpose:', understanding.purpose.substring(0, 100) + '...');
  } else {
    results.partial.push('Purpose missing expected keywords');
    console.log('[PARTIAL] Purpose:', understanding.purpose.substring(0, 100) + '...');
  }

  // ARCHITECTURE
  console.log('\n### ARCHITECTURE\n');

  if (understanding.architecture.type === GROUND_TRUTH.architectureType) {
    results.accurate.push('Architecture type');
    console.log('[PASS] Architecture type:', understanding.architecture.type);
  } else {
    results.inaccurate.push('Architecture type: expected ' + GROUND_TRUTH.architectureType + ', got ' + understanding.architecture.type);
    console.log('[FAIL] Architecture type: expected', GROUND_TRUTH.architectureType, 'got', understanding.architecture.type);
  }

  const foundLayers = understanding.architecture.layers.map(l => l.toLowerCase());
  const matchedLayers = GROUND_TRUTH.expectedLayers.filter(l => foundLayers.includes(l));
  const layerCoverage = matchedLayers.length / GROUND_TRUTH.expectedLayers.length;

  if (layerCoverage >= 0.7) {
    results.accurate.push('Architectural layers');
    console.log('[PASS] Layers:', understanding.architecture.layers.join(', '));
    console.log('       Matched', matchedLayers.length + '/' + GROUND_TRUTH.expectedLayers.length, 'expected layers');
  } else if (layerCoverage >= 0.4) {
    results.partial.push('Some architectural layers detected');
    console.log('[PARTIAL] Layers:', understanding.architecture.layers.join(', '));
    console.log('          Missing:', GROUND_TRUTH.expectedLayers.filter(l => !foundLayers.includes(l)).join(', '));
  } else {
    results.inaccurate.push('Architectural layers mostly missing');
    console.log('[FAIL] Layers:', understanding.architecture.layers.join(', '));
  }

  const hasCliEntryPoint = understanding.architecture.entryPoints.some(ep =>
    GROUND_TRUTH.entryPointPatterns.some(pattern => ep.toLowerCase().includes(pattern.toLowerCase()))
  );
  if (hasCliEntryPoint) {
    results.accurate.push('Entry points identified');
    console.log('[PASS] Entry points:', understanding.architecture.entryPoints.slice(0, 5).join(', '));
  } else if (understanding.architecture.entryPoints.length > 0) {
    results.partial.push('Entry points found but may not include CLI');
    console.log('[PARTIAL] Entry points:', understanding.architecture.entryPoints.slice(0, 5).join(', '));
  } else {
    results.inaccurate.push('No entry points detected');
    console.log('[FAIL] Entry points: none detected');
  }

  // LANGUAGES
  console.log('\n### LANGUAGES\n');

  if (understanding.primaryLanguage === GROUND_TRUTH.primaryLanguage) {
    results.accurate.push('Primary language');
    console.log('[PASS] Primary language:', understanding.primaryLanguage);
  } else {
    results.inaccurate.push('Primary language: expected ' + GROUND_TRUTH.primaryLanguage + ', got ' + understanding.primaryLanguage);
    console.log('[FAIL] Primary language: expected', GROUND_TRUTH.primaryLanguage, 'got', understanding.primaryLanguage);
  }

  const hasExpectedLangs = GROUND_TRUTH.languages.every(lang => understanding.languages.includes(lang));
  if (hasExpectedLangs) {
    results.accurate.push('Languages detected');
    console.log('[PASS] Languages:', understanding.languages.join(', '));
  } else {
    results.partial.push('Some languages missing');
    console.log('[PARTIAL] Languages:', understanding.languages.join(', '));
  }

  // CONVENTIONS
  console.log('\n### CONVENTIONS\n');

  if (understanding.conventions.namingStyle === GROUND_TRUTH.namingStyle) {
    results.accurate.push('Naming style');
    console.log('[PASS] Naming style:', understanding.conventions.namingStyle);
  } else {
    results.partial.push('Naming style: got ' + understanding.conventions.namingStyle);
    console.log('[PARTIAL] Naming style:', understanding.conventions.namingStyle);
  }

  if (understanding.conventions.testPattern.includes(GROUND_TRUTH.testPattern)) {
    results.accurate.push('Test pattern');
    console.log('[PASS] Test pattern:', understanding.conventions.testPattern);
  } else {
    results.partial.push('Test pattern: got ' + understanding.conventions.testPattern);
    console.log('[PARTIAL] Test pattern:', understanding.conventions.testPattern);
  }

  if (understanding.conventions.importStyle === GROUND_TRUTH.importStyle) {
    results.accurate.push('Import style');
    console.log('[PASS] Import style:', understanding.conventions.importStyle);
  } else {
    results.partial.push('Import style: got ' + understanding.conventions.importStyle);
    console.log('[PARTIAL] Import style:', understanding.conventions.importStyle);
  }

  console.log('[INFO] Config format:', understanding.conventions.configFormat);

  // DEPENDENCIES
  console.log('\n### DEPENDENCIES\n');

  const hasVitest = understanding.dependencies.testFrameworks.includes('Vitest');
  if (hasVitest) {
    results.accurate.push('Test framework (Vitest)');
    console.log('[PASS] Test frameworks:', understanding.dependencies.testFrameworks.join(', '));
  } else {
    results.inaccurate.push('Vitest not detected');
    console.log('[FAIL] Test frameworks:', understanding.dependencies.testFrameworks.join(', '));
  }

  console.log('[INFO] Frameworks:', understanding.dependencies.frameworks.length > 0 ? understanding.dependencies.frameworks.join(', ') : 'none');
  console.log('[INFO] Runtime deps:', understanding.dependencies.runtime.length);
  console.log('[INFO] Dev deps:', understanding.dependencies.dev.length);

  // AGENT GUIDANCE
  console.log('\n### AGENT GUIDANCE\n');

  if (understanding.agentGuidance.beforeModifying.length > 0) {
    results.accurate.push('Agent guidance generated');
    console.log('[PASS] Before modifying:', understanding.agentGuidance.beforeModifying.length, 'items');
    understanding.agentGuidance.beforeModifying.slice(0, 3).forEach(g => console.log('       -', g));
  } else {
    results.inaccurate.push('No agent guidance');
    console.log('[FAIL] No guidance generated');
  }

  if (understanding.agentGuidance.commonPatterns.length > 0) {
    console.log('[PASS] Common patterns:', understanding.agentGuidance.commonPatterns.length, 'items');
    understanding.agentGuidance.commonPatterns.slice(0, 3).forEach(p => console.log('       -', p));
  }

  // METADATA
  console.log('\n### METADATA\n');
  console.log('[INFO] Confidence:', (understanding.metadata.confidence * 100).toFixed(1) + '%');
  console.log('[INFO] Sources:', understanding.metadata.sources.join(', '));

  // SUMMARY
  console.log('\n' + '='.repeat(70));
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(70));

  const totalChecks = results.accurate.length + results.partial.length + results.inaccurate.length;
  const accuracyScore = ((results.accurate.length + (results.partial.length * 0.5)) / totalChecks * 100).toFixed(1);

  console.log('\nAccurate:', results.accurate.length, 'items');
  results.accurate.forEach(item => console.log('  [PASS]', item));

  console.log('\nPartial:', results.partial.length, 'items');
  results.partial.forEach(item => console.log('  [PARTIAL]', item));

  console.log('\nInaccurate:', results.inaccurate.length, 'items');
  results.inaccurate.forEach(item => console.log('  [FAIL]', item));

  console.log('\n' + '='.repeat(70));
  console.log('OVERALL ACCURACY SCORE:', accuracyScore + '%');
  console.log('='.repeat(70));

  console.log('\n\n### FULL OUTPUT (JSON)\n');
  console.log(JSON.stringify(understanding, null, 2));

  await storage.close();
  return { score: parseFloat(accuracyScore), results, understanding };
}

runTest()
  .then(({ score }) => process.exit(score >= 70 ? 0 : 1))
  .catch(err => { console.error('Error:', err); process.exit(1); });
