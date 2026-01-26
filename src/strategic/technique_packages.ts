export interface TechniquePackage {
  id: string;
  name: string;
  description: string;
  primitiveIds: string[];
  compositionIds: string[];
  categories: string[];
  domains: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SAFE_ID_REQUIRED = /[a-zA-Z0-9]/;
const MAX_ID_LENGTH = 120;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;

function assertId(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ID_LENGTH ||
    !SAFE_ID_PATTERN.test(value) ||
    !SAFE_ID_REQUIRED.test(value)
  ) {
    throw new Error(`unverified_by_trace(invalid_${label})`);
  }
  return value;
}

function assertNonEmptyString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`unverified_by_trace(invalid_${label})`);
  }
  return value.trim();
}

function assertIdList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`unverified_by_trace(invalid_${label})`);
  }
  const seen = new Set<string>();
  value.forEach((entry) => {
    const id = assertId(entry, label);
    if (seen.has(id)) {
      throw new Error(`unverified_by_trace(duplicate_${label})`);
    }
    seen.add(id);
  });
  return value;
}

export function createTechniquePackage(input: {
  id: string;
  name: string;
  description: string;
  primitiveIds: string[];
  compositionIds?: string[];
  categories?: string[];
  domains?: string[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}): TechniquePackage {
  const now = new Date().toISOString();
  assertId(input.id, 'package_id');
  const name = assertNonEmptyString(input.name, 'package_name', MAX_NAME_LENGTH);
  const description = assertNonEmptyString(input.description, 'package_description', MAX_DESCRIPTION_LENGTH);
  const primitiveIds = assertIdList(input.primitiveIds, 'package_primitive_id');
  const compositionIds = input.compositionIds?.length
    ? assertIdList(input.compositionIds, 'package_composition_id')
    : [];
  return {
    id: input.id,
    name,
    description,
    primitiveIds,
    compositionIds,
    categories: input.categories ?? [],
    domains: input.domains ?? [],
    tags: input.tags ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
