import type { VerificationMethod } from './work_primitives.js';

export interface VerificationPlanCost {
  timeMinutes?: number;
  tokenBudget?: number;
  providerBudget?: number;
}

export interface VerificationPlan {
  id: string;
  target: string;
  methods: VerificationMethod[];
  expectedObservations: string[];
  cost?: VerificationPlanCost;
  risk?: string[];
  artifacts?: string[];
  createdAt: string;
  updatedAt: string;
}

export function createVerificationPlan(input: {
  id: string;
  target: string;
  methods: VerificationMethod[];
  expectedObservations: string[];
  cost?: VerificationPlanCost;
  risk?: string[];
  artifacts?: string[];
  createdAt?: string;
  updatedAt?: string;
}): VerificationPlan {
  const now = new Date().toISOString();
  return {
    id: input.id,
    target: input.target,
    methods: input.methods,
    expectedObservations: input.expectedObservations,
    cost: input.cost,
    risk: input.risk,
    artifacts: input.artifacts,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
