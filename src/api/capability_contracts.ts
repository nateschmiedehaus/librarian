export type Capability =
  | 'llm:chat'
  | 'llm:embedding'
  | 'storage:sqlite'
  | 'storage:vector'
  | 'tool:filesystem'
  | 'tool:git'
  | 'tool:mcp';

export interface CapabilityContract {
  required: Capability[];
  optional: Capability[];
  degradedMode: string;
}

export interface CapabilityNegotiationResult {
  satisfied: boolean;
  missing: Capability[];
  degraded: string | null;
}

export function negotiateCapabilities(required: Capability[], available: Capability[]): CapabilityNegotiationResult {
  const requiredSet = new Set(required);
  const availableSet = new Set(available);

  const missing = Array.from(requiredSet).filter((capability) => !availableSet.has(capability));
  return {
    satisfied: missing.length === 0,
    missing,
    degraded: missing.length === 0 ? null : 'missing_required_capabilities',
  };
}

export function negotiateCapabilityContract(
  contract: CapabilityContract,
  available: Capability[]
): CapabilityNegotiationResult {
  const requiredResult = negotiateCapabilities(contract.required, available);
  if (!requiredResult.satisfied) {
    return {
      satisfied: false,
      missing: requiredResult.missing,
      degraded: contract.degradedMode || requiredResult.degraded,
    };
  }

  const optionalResult = contract.optional.length > 0 ? negotiateCapabilities(contract.optional, available) : null;
  if (optionalResult && !optionalResult.satisfied) {
    return {
      satisfied: true,
      missing: optionalResult.missing,
      degraded: contract.degradedMode,
    };
  }

  return { satisfied: true, missing: [], degraded: null };
}

export function requireCapabilities(required: Capability[], available: Capability[], detail?: string): void {
  const result = negotiateCapabilities(required, available);
  if (result.satisfied) return;

  const missing = result.missing.join(',') || 'unknown';
  const suffix = detail ? `: ${detail}` : '';
  throw new Error(`unverified_by_trace(capability_missing): missing=${missing}${suffix}`);
}

