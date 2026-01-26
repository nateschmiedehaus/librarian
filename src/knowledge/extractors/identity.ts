/**
 * @fileoverview Identity Extractor
 *
 * Extracts identity information (questions 1-15) from code entities:
 * - Name, qualified name, location
 * - Language, framework detection
 * - Visibility, token count
 * - Content hash
 */

import { createHash } from 'crypto';
import * as path from 'path';
import type { EntityLocation, Visibility, EntityKind } from '../universal_types.js';

export interface IdentityExtraction {
  id: string;
  name: string;
  qualifiedName: string;
  kind: EntityKind;
  location: EntityLocation;
  language: string;
  framework?: string;
  module: string;
  visibility: Visibility;
  hash: string;
  tokenCount: number;
  confidence: number;
}

export interface IdentityInput {
  filePath: string;
  name: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  content?: string;
  signature?: string;
}

/**
 * Extract identity information from a code entity.
 */
export function extractIdentity(input: IdentityInput): IdentityExtraction {
  const ext = path.extname(input.filePath).toLowerCase();
  const language = detectLanguage(ext);
  const framework = detectFramework(input.filePath, input.content);
  const kind = detectKind(input.name, input.signature, input.content);
  const visibility = detectVisibility(input.content, input.signature);

  // Compute content hash for change detection
  const hashContent = input.content || input.signature || input.name;
  const hash = createHash('sha256')
    .update(hashContent)
    .digest('hex')
    .slice(0, 16);

  // Estimate token count (rough approximation: ~4 chars per token)
  const contentLength = (input.content || input.signature || '').length;
  const tokenCount = Math.ceil(contentLength / 4);

  // Build qualified name
  const qualifiedName = buildQualifiedName(input.filePath, input.name);

  // Generate stable ID
  const id = createHash('sha256')
    .update(`${input.filePath}:${input.name}:${input.startLine}`)
    .digest('hex')
    .slice(0, 24);

  return {
    id,
    name: input.name,
    qualifiedName,
    kind,
    location: {
      file: input.filePath,
      line: input.startLine,
      column: input.startColumn ?? 0,
      endLine: input.endLine,
      endColumn: input.endColumn ?? 0,
      byteRange: [0, contentLength],
    },
    language,
    framework,
    module: path.dirname(input.filePath),
    visibility,
    hash,
    tokenCount,
    confidence: 0.95, // High confidence for AST-based extraction
  };
}

function detectLanguage(ext: string): string {
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
  };
  return langMap[ext] || 'unknown';
}

function detectFramework(filePath: string, content?: string): string | undefined {
  const pathLower = filePath.toLowerCase();
  const contentLower = (content || '').toLowerCase();

  // React
  if (pathLower.includes('.tsx') || pathLower.includes('.jsx')) {
    if (contentLower.includes('react') || contentLower.includes('usestate') || contentLower.includes('useeffect')) {
      return 'react';
    }
  }

  // Next.js
  if (pathLower.includes('/pages/') || pathLower.includes('/app/')) {
    if (contentLower.includes('next') || contentLower.includes('getserversideprops')) {
      return 'nextjs';
    }
  }

  // Express
  if (contentLower.includes('express') || contentLower.includes('app.get(') || contentLower.includes('app.post(')) {
    return 'express';
  }

  // Vue
  if (pathLower.endsWith('.vue') || contentLower.includes('vue')) {
    return 'vue';
  }

  // Angular
  if (contentLower.includes('@component') || contentLower.includes('@injectable')) {
    return 'angular';
  }

  return undefined;
}

function detectKind(name: string, signature?: string, content?: string): EntityKind {
  const sig = signature?.toLowerCase() || '';
  const cont = content?.toLowerCase() || '';
  const nameLower = name.toLowerCase();

  // Test files
  if (nameLower.includes('test') || nameLower.includes('spec')) {
    return 'test';
  }

  // Config files
  if (nameLower.includes('config') || nameLower.includes('settings')) {
    return 'config';
  }

  // Classes
  if (sig.includes('class ') || cont.includes('class ')) {
    return 'class';
  }

  // Interfaces
  if (sig.includes('interface ') || cont.includes('interface ')) {
    return 'interface';
  }

  // Types
  if (sig.includes('type ') && sig.includes('=')) {
    return 'type';
  }

  // Components (React/Vue)
  if (name[0] === name[0].toUpperCase() && (cont.includes('jsx') || cont.includes('tsx') || cont.includes('render'))) {
    return 'component';
  }

  // Hooks
  if (nameLower.startsWith('use')) {
    return 'hook';
  }

  // Middleware
  if (nameLower.includes('middleware') || (sig.includes('req') && sig.includes('res') && sig.includes('next'))) {
    return 'middleware';
  }

  // Routes
  if (nameLower.includes('route') || nameLower.includes('handler')) {
    return 'route';
  }

  // Default to function
  return 'function';
}

function detectVisibility(content?: string, signature?: string): Visibility {
  const text = (content || '') + (signature || '');

  if (text.includes('private ') || text.includes('#')) {
    return 'private';
  }
  if (text.includes('protected ')) {
    return 'protected';
  }
  if (text.includes('internal ')) {
    return 'internal';
  }
  // TypeScript/JavaScript default
  if (text.includes('export ')) {
    return 'public';
  }
  // Not exported = internal
  return 'internal';
}

function buildQualifiedName(filePath: string, name: string): string {
  // Remove common prefixes and extensions
  const normalized = filePath
    .replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '')
    .replace(/^.*\/src\//, '')
    .replace(/^.*\/lib\//, '')
    .replace(/\/index$/, '');

  return `${normalized}:${name}`;
}
