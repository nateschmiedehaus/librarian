/**
 * @fileoverview Function-Level Chunking for Embeddings
 *
 * Instead of embedding entire files (which get truncated), this module:
 * 1. Parses code into functions/classes/methods
 * 2. Creates embeddings for each chunk
 * 3. Enables fine-grained similarity matching
 *
 * Benefits:
 * - No truncation (each function fits in context)
 * - Better granularity (find similar functions, not just files)
 * - More accurate similarity (compare apples to apples)
 */

import * as ts from 'typescript';
import {
  generateRealEmbedding,
  cosineSimilarity,
  type EmbeddingModelId,
} from './real_embeddings.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CodeChunk {
  id: string;
  filePath: string;
  type: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable' | 'module';
  name: string;
  signature: string;
  body: string;
  startLine: number;
  endLine: number;
  parentClass?: string;
  exports: boolean;
  async: boolean;
}

export interface ChunkEmbedding {
  chunk: CodeChunk;
  embedding: Float32Array;
  embeddingInput: string;
}

export interface FileChunks {
  filePath: string;
  chunks: CodeChunk[];
  embeddings?: ChunkEmbedding[];
}

// ============================================================================
// AST PARSING
// ============================================================================

/**
 * Parse a TypeScript/JavaScript file into code chunks.
 */
export function parseFileIntoChunks(filePath: string, content: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  try {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const visit = (node: ts.Node, parentClass?: string) => {
      // Function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        chunks.push(createChunkFromFunction(node, sourceFile, content, filePath));
      }
      // Arrow functions assigned to variables
      else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            if (ts.isIdentifier(decl.name)) {
              chunks.push(createChunkFromVariableFunction(decl, node, sourceFile, content, filePath));
            }
          }
        }
      }
      // Class declarations
      else if (ts.isClassDeclaration(node) && node.name) {
        chunks.push(createChunkFromClass(node, sourceFile, content, filePath));

        // Also extract methods
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            chunks.push(createChunkFromMethod(member, node.name.text, sourceFile, content, filePath));
          }
        }
      }
      // Interface declarations
      else if (ts.isInterfaceDeclaration(node)) {
        chunks.push(createChunkFromInterface(node, sourceFile, content, filePath));
      }
      // Type alias declarations
      else if (ts.isTypeAliasDeclaration(node)) {
        chunks.push(createChunkFromTypeAlias(node, sourceFile, content, filePath));
      }

      ts.forEachChild(node, (child) => visit(child, parentClass));
    };

    visit(sourceFile);
  } catch (error) {
    console.warn(`[chunking] Failed to parse ${filePath}:`, error);
  }

  return chunks;
}

function createChunkFromFunction(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  content: string,
  filePath: string
): CodeChunk {
  const name = node.name?.text || 'anonymous';
  const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  const signature = buildFunctionSignature(node);
  const body = content.slice(node.getStart(), node.getEnd());

  const hasExportModifier = node.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword
  );
  const isAsync = node.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.AsyncKeyword
  );

  return {
    id: `${filePath}:${name}:${startLine}`,
    filePath,
    type: 'function',
    name,
    signature,
    body: body.slice(0, 2000), // Limit body size
    startLine: startLine + 1,
    endLine: endLine + 1,
    exports: !!hasExportModifier,
    async: !!isAsync,
  };
}

function createChunkFromVariableFunction(
  decl: ts.VariableDeclaration,
  stmt: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  content: string,
  filePath: string
): CodeChunk {
  const name = (decl.name as ts.Identifier).text;
  const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(stmt.getStart());
  const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(stmt.getEnd());

  const body = content.slice(stmt.getStart(), stmt.getEnd());
  const signature = `const ${name} = ${decl.initializer && ts.isArrowFunction(decl.initializer) ? '() => ...' : 'function()'}`;

  const hasExportModifier = stmt.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword
  );

  const isAsync = decl.initializer && (
    (ts.isArrowFunction(decl.initializer) && decl.initializer.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) ||
    (ts.isFunctionExpression(decl.initializer) && decl.initializer.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword))
  );

  return {
    id: `${filePath}:${name}:${startLine}`,
    filePath,
    type: 'function',
    name,
    signature,
    body: body.slice(0, 2000),
    startLine: startLine + 1,
    endLine: endLine + 1,
    exports: !!hasExportModifier,
    async: !!isAsync,
  };
}

function createChunkFromClass(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  content: string,
  filePath: string
): CodeChunk {
  const name = node.name?.text || 'AnonymousClass';
  const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  // Build class signature (without full body)
  const heritage = node.heritageClauses?.map((h) => h.getText(sourceFile)).join(' ') || '';
  const signature = `class ${name} ${heritage}`.trim();

  const body = content.slice(node.getStart(), node.getEnd());

  const hasExportModifier = node.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword
  );

  return {
    id: `${filePath}:${name}:${startLine}`,
    filePath,
    type: 'class',
    name,
    signature,
    body: body.slice(0, 3000), // Classes can be larger
    startLine: startLine + 1,
    endLine: endLine + 1,
    exports: !!hasExportModifier,
    async: false,
  };
}

function createChunkFromMethod(
  node: ts.MethodDeclaration,
  className: string,
  sourceFile: ts.SourceFile,
  content: string,
  filePath: string
): CodeChunk {
  const name = node.name.getText(sourceFile);
  const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  const signature = `${className}.${name}${buildParameterList(node)}`;
  const body = content.slice(node.getStart(), node.getEnd());

  const isAsync = node.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.AsyncKeyword
  );

  return {
    id: `${filePath}:${className}.${name}:${startLine}`,
    filePath,
    type: 'method',
    name,
    signature,
    body: body.slice(0, 2000),
    startLine: startLine + 1,
    endLine: endLine + 1,
    parentClass: className,
    exports: false, // Methods inherit from class
    async: !!isAsync,
  };
}

function createChunkFromInterface(
  node: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  content: string,
  filePath: string
): CodeChunk {
  const name = node.name.text;
  const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  const body = content.slice(node.getStart(), node.getEnd());

  const hasExportModifier = node.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword
  );

  return {
    id: `${filePath}:${name}:${startLine}`,
    filePath,
    type: 'interface',
    name,
    signature: `interface ${name}`,
    body: body.slice(0, 2000),
    startLine: startLine + 1,
    endLine: endLine + 1,
    exports: !!hasExportModifier,
    async: false,
  };
}

function createChunkFromTypeAlias(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  content: string,
  filePath: string
): CodeChunk {
  const name = node.name.text;
  const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  const body = content.slice(node.getStart(), node.getEnd());

  const hasExportModifier = node.modifiers?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword
  );

  return {
    id: `${filePath}:${name}:${startLine}`,
    filePath,
    type: 'type',
    name,
    signature: `type ${name}`,
    body: body.slice(0, 1000),
    startLine: startLine + 1,
    endLine: endLine + 1,
    exports: !!hasExportModifier,
    async: false,
  };
}

function buildFunctionSignature(node: ts.FunctionDeclaration): string {
  const name = node.name?.text || 'anonymous';
  const params = buildParameterList(node);
  const returnType = node.type ? `: ${node.type.getText()}` : '';
  const asyncPrefix = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
  return `${asyncPrefix}function ${name}${params}${returnType}`;
}

function buildParameterList(node: ts.FunctionDeclaration | ts.MethodDeclaration): string {
  const params = node.parameters.map((p) => {
    const name = p.name.getText();
    const type = p.type ? `: ${p.type.getText()}` : '';
    const optional = p.questionToken ? '?' : '';
    return `${name}${optional}${type}`;
  });
  return `(${params.join(', ')})`;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Build embedding input for a code chunk.
 * Includes metadata for better semantic understanding.
 */
export function buildChunkEmbeddingInput(chunk: CodeChunk): string {
  const parts: string[] = [];

  // Type and name
  parts.push(`${chunk.type}: ${chunk.name}`);

  // Signature
  parts.push(`Signature: ${chunk.signature}`);

  // File context
  parts.push(`File: ${chunk.filePath}`);

  // Modifiers
  const modifiers: string[] = [];
  if (chunk.exports) modifiers.push('exported');
  if (chunk.async) modifiers.push('async');
  if (chunk.parentClass) modifiers.push(`member of ${chunk.parentClass}`);
  if (modifiers.length > 0) {
    parts.push(`Modifiers: ${modifiers.join(', ')}`);
  }

  // Body (main content)
  parts.push('Code:');
  parts.push(chunk.body);

  return parts.join('\n');
}

/**
 * Generate embeddings for all chunks in a file.
 */
export async function embedFileChunks(
  filePath: string,
  content: string,
  modelId: EmbeddingModelId = 'all-MiniLM-L6-v2'
): Promise<FileChunks> {
  const chunks = parseFileIntoChunks(filePath, content);
  const embeddings: ChunkEmbedding[] = [];

  for (const chunk of chunks) {
    const input = buildChunkEmbeddingInput(chunk);
    const result = await generateRealEmbedding(input, modelId);

    embeddings.push({
      chunk,
      embedding: result.embedding,
      embeddingInput: input,
    });
  }

  return {
    filePath,
    chunks,
    embeddings,
  };
}

// ============================================================================
// SIMILARITY COMPUTATION
// ============================================================================

/**
 * Compute similarity between two files using chunk-level comparison.
 *
 * Strategy:
 * 1. Find best-matching chunk pairs
 * 2. Aggregate scores
 */
export function computeChunkSimilarity(
  fileA: FileChunks,
  fileB: FileChunks,
  options: {
    aggregation?: 'max' | 'mean' | 'weighted';
  } = {}
): {
  similarity: number;
  bestMatches: Array<{
    chunkA: CodeChunk;
    chunkB: CodeChunk;
    similarity: number;
  }>;
} {
  const { aggregation = 'weighted' } = options;

  if (!fileA.embeddings || !fileB.embeddings) {
    return { similarity: 0, bestMatches: [] };
  }

  if (fileA.embeddings.length === 0 || fileB.embeddings.length === 0) {
    return { similarity: 0, bestMatches: [] };
  }

  // Compute all pairwise similarities
  const pairSimilarities: Array<{
    chunkA: CodeChunk;
    chunkB: CodeChunk;
    similarity: number;
  }> = [];

  for (const embA of fileA.embeddings) {
    for (const embB of fileB.embeddings) {
      const sim = cosineSimilarity(embA.embedding, embB.embedding);
      pairSimilarities.push({
        chunkA: embA.chunk,
        chunkB: embB.chunk,
        similarity: sim,
      });
    }
  }

  // Sort by similarity
  pairSimilarities.sort((a, b) => b.similarity - a.similarity);

  // Get best matches (each chunk matched at most once)
  const usedA = new Set<string>();
  const usedB = new Set<string>();
  const bestMatches: typeof pairSimilarities = [];

  for (const pair of pairSimilarities) {
    if (usedA.has(pair.chunkA.id) || usedB.has(pair.chunkB.id)) {
      continue;
    }
    bestMatches.push(pair);
    usedA.add(pair.chunkA.id);
    usedB.add(pair.chunkB.id);
  }

  // Aggregate similarity
  let similarity: number;

  if (aggregation === 'max') {
    similarity = bestMatches[0]?.similarity || 0;
  } else if (aggregation === 'mean') {
    similarity = bestMatches.reduce((sum, m) => sum + m.similarity, 0) / bestMatches.length;
  } else {
    // Weighted: give more weight to functions/methods, less to types
    let totalWeight = 0;
    let weightedSum = 0;

    for (const match of bestMatches) {
      const weight = getChunkWeight(match.chunkA) + getChunkWeight(match.chunkB);
      weightedSum += match.similarity * weight;
      totalWeight += weight;
    }

    similarity = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  return { similarity, bestMatches: bestMatches.slice(0, 5) };
}

function getChunkWeight(chunk: CodeChunk): number {
  switch (chunk.type) {
    case 'function':
      return 2.0;
    case 'method':
      return 1.5;
    case 'class':
      return 1.5;
    case 'interface':
      return 1.0;
    case 'type':
      return 0.5;
    default:
      return 1.0;
  }
}

// All exports are inline above
