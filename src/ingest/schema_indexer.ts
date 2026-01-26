import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import { getErrorMessage } from '../utils/errors.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';

export interface SchemaTable { name: string; source: string; }
export interface SchemaRelation { from: string; to: string; type: 'foreign_key' | 'relation' | 'entity_ref'; source: string; }

export interface SchemaIngestionOptions {
  sqlGlobs?: string[];
  prismaGlobs?: string[];
  typeormGlobs?: string[];
  exclude?: string[];
  maxFileBytes?: number;
  maxFiles?: number;
}

const DEFAULT_SQL_GLOBS = ['**/migrations/**/*.sql', '**/migration/**/*.sql', '**/schema.sql'];
const DEFAULT_PRISMA_GLOBS = ['schema.prisma', 'prisma/schema.prisma'];
const DEFAULT_TYPEORM_GLOBS = ['src/**/*.{entity,model}.ts', 'src/**/*entity*.ts'];
const DEFAULT_MAX_BYTES = 256_000;
const DEFAULT_MAX_FILES = 200;
const SCHEMA_TAXONOMY: TaxonomyItem[] = ['database_schema', 'migration_history'];

function hashPayload(payload: unknown): string {
  try {
    return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
  } catch {
    return createHash('sha256').update('{}').digest('hex');
  }
}

function parseSqlSchema(content: string, source: string): { tables: SchemaTable[]; relations: SchemaRelation[] } {
  const tables: SchemaTable[] = [];
  const relations: SchemaRelation[] = [];
  const tableRegex = /CREATE TABLE\s+["`]?([A-Za-z0-9_]+)["`]?/gi;
  let match: RegExpExecArray | null = tableRegex.exec(content);
  while (match) {
    tables.push({ name: match[1] ?? 'unknown', source });
    match = tableRegex.exec(content);
  }
  const fkRegex = /FOREIGN KEY\s*\(["`]?([A-Za-z0-9_]+)["`]?\)\s*REFERENCES\s+["`]?([A-Za-z0-9_]+)["`]?/gi;
  match = fkRegex.exec(content);
  while (match) {
    relations.push({ from: match[1] ?? 'unknown', to: match[2] ?? 'unknown', type: 'foreign_key', source });
    match = fkRegex.exec(content);
  }
  return { tables, relations };
}

function parsePrismaSchema(content: string, source: string): { tables: SchemaTable[]; relations: SchemaRelation[] } {
  const tables: SchemaTable[] = [];
  const relations: SchemaRelation[] = [];
  const modelRegex = /model\s+([A-Za-z0-9_]+)\s*{([\s\S]*?)}/g;
  let match: RegExpExecArray | null = modelRegex.exec(content);
  while (match) {
    const modelName = match[1] ?? 'unknown';
    const body = match[2] ?? '';
    tables.push({ name: modelName, source });
    const lines = body.split(/\r?\n/);
    for (const line of lines) {
      if (!line.includes('@relation')) continue;
      const typeMatch = line.trim().match(/^[A-Za-z0-9_]+\s+([A-Za-z0-9_]+)/);
      if (typeMatch?.[1]) {
        relations.push({ from: modelName, to: typeMatch[1], type: 'relation', source });
      }
    }
    match = modelRegex.exec(content);
  }
  return { tables, relations };
}

function parseTypeOrmEntities(content: string, source: string): { tables: SchemaTable[]; relations: SchemaRelation[] } {
  const tables: SchemaTable[] = [];
  const relations: SchemaRelation[] = [];
  const entityRegex = /@Entity\([^)]*\)\s*export\s+class\s+([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null = entityRegex.exec(content);
  while (match) {
    tables.push({ name: match[1] ?? 'unknown', source });
    match = entityRegex.exec(content);
  }
  const relationRegex = /@(ManyToOne|OneToMany|OneToOne|ManyToMany)\(\s*\(\)\s*=>\s*([A-Za-z0-9_]+)\s*\)/g;
  match = relationRegex.exec(content);
  while (match) {
    relations.push({ from: 'unknown', to: match[2] ?? 'unknown', type: 'entity_ref', source });
    match = relationRegex.exec(content);
  }
  return { tables, relations };
}

export function createSchemaIngestionSource(options: SchemaIngestionOptions = {}): IngestionSource {
  const sqlGlobs = options.sqlGlobs ?? DEFAULT_SQL_GLOBS;
  const prismaGlobs = options.prismaGlobs ?? DEFAULT_PRISMA_GLOBS;
  const typeormGlobs = options.typeormGlobs ?? DEFAULT_TYPEORM_GLOBS;
  const exclude = options.exclude ?? [];
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  return {
    type: 'schema',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { tables?: unknown[]; relations?: unknown[] } };
      return Array.isArray(item.payload?.tables) && Array.isArray(item.payload?.relations);
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      const items: IngestionItem[] = [];
      const errors: string[] = [];
      const tables: SchemaTable[] = [];
      const relations: SchemaRelation[] = [];
      const sqlFiles = (await glob(sqlGlobs, { cwd: ctx.workspace, ignore: exclude, absolute: true })).slice(0, maxFiles);
      const prismaFiles = (await glob(prismaGlobs, { cwd: ctx.workspace, ignore: exclude, absolute: true })).slice(0, maxFiles);
      const typeormFiles = (await glob(typeormGlobs, { cwd: ctx.workspace, ignore: exclude, absolute: true })).slice(0, maxFiles);

      for (const filePath of [...sqlFiles, ...prismaFiles, ...typeormFiles]) {
        let content = '';
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileBytes) continue;
          content = await fs.readFile(filePath, 'utf8');
        } catch (error: unknown) {
          errors.push(`Failed to read ${filePath}: ${getErrorMessage(error)}`);
          continue;
        }
        const relative = path.relative(ctx.workspace, filePath);
        if (filePath.endsWith('.sql')) {
          const parsed = parseSqlSchema(content, relative);
          tables.push(...parsed.tables);
          relations.push(...parsed.relations);
        } else if (filePath.endsWith('.prisma')) {
          const parsed = parsePrismaSchema(content, relative);
          tables.push(...parsed.tables);
          relations.push(...parsed.relations);
        } else {
          const parsed = parseTypeOrmEntities(content, relative);
          tables.push(...parsed.tables);
          relations.push(...parsed.relations);
        }
      }

      const payload = {
        tables,
        relations,
        migrations: sqlFiles.map((file) => path.relative(ctx.workspace, file)),
        schema_files: [...prismaFiles, ...typeormFiles].map((file) => path.relative(ctx.workspace, file)),
      };

      items.push({
        id: 'schema:knowledge',
        sourceType: 'schema',
        sourceVersion: 'v1',
        ingestedAt: ctx.now(),
        payload,
        metadata: {
          hash: hashPayload(payload),
          taxonomy: SCHEMA_TAXONOMY,
          table_count: tables.length,
          relation_count: relations.length,
        },
      });

      return { items, errors };
    },
  };
}
