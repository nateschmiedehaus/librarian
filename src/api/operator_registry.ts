import type { TechniqueComposition, TechniqueOperator, TechniqueOperatorType } from '../strategic/techniques.js';
import type { OperatorInterpreter } from './operator_interpreters.js';
import { DEFAULT_OPERATOR_INTERPRETERS } from './operator_interpreters.js';

export interface ExecutionPlan {
  steps: string[];
  parallelGroups: string[][];
  conditionalBranches: Array<{ operatorId: string; outputs: string[] }>;
  loopBoundaries: Array<{ operatorId: string; inputs: string[] }>;
  operators: Array<{ id: string; type: TechniqueOperatorType; inputs: string[]; outputs: string[] }>;
}

export class OperatorInterpreterRegistry {
  private interpreters = new Map<TechniqueOperatorType, OperatorInterpreter>();

  register(interpreter: OperatorInterpreter): void {
    this.interpreters.set(interpreter.operatorType, interpreter);
  }

  registerAll(interpreters: OperatorInterpreter[]): void {
    for (const interpreter of interpreters) {
      this.register(interpreter);
    }
  }

  unregister(operatorType: TechniqueOperatorType): void {
    this.interpreters.delete(operatorType);
  }

  get(operatorType: TechniqueOperatorType): OperatorInterpreter | undefined {
    return this.interpreters.get(operatorType);
  }

  getOrThrow(operatorType: TechniqueOperatorType): OperatorInterpreter {
    const interpreter = this.get(operatorType);
    if (!interpreter) {
      throw new Error(`unverified_by_trace(operator_interpreter_missing): ${operatorType}`);
    }
    return interpreter;
  }

  getAll(): OperatorInterpreter[] {
    return Array.from(this.interpreters.values());
  }

  buildExecutionPlan(composition: TechniqueComposition): ExecutionPlan {
    const primitiveIds = composition.primitiveIds ?? [];
    const primitiveSet = new Set(primitiveIds);
    const operatorIds = new Set<string>();
    const plan: ExecutionPlan = {
      steps: primitiveIds.slice(),
      parallelGroups: [],
      conditionalBranches: [],
      loopBoundaries: [],
      operators: [],
    };

    for (const operator of composition.operators ?? []) {
      if (operatorIds.has(operator.id)) {
        throw new Error(`unverified_by_trace(operator_duplicate_id): ${operator.id}`);
      }
      operatorIds.add(operator.id);
      this.getOrThrow(operator.type);
      const inputs = Array.isArray(operator.inputs) ? operator.inputs.filter(Boolean) : [];
      const outputs = Array.isArray(operator.outputs) ? operator.outputs.filter(Boolean) : [];
      for (const id of inputs) {
        if (!primitiveSet.has(id)) {
          throw new Error(`unverified_by_trace(operator_input_missing): ${id}`);
        }
      }
      for (const id of outputs) {
        if (!primitiveSet.has(id)) {
          throw new Error(`unverified_by_trace(operator_output_missing): ${id}`);
        }
      }
      plan.operators.push({
        id: operator.id,
        type: operator.type,
        inputs: inputs.slice(),
        outputs: outputs.slice(),
      });
      if (operator.type === 'parallel') {
        if (inputs.length > 1) {
          plan.parallelGroups.push(inputs.slice());
        }
      }
      if (operator.type === 'conditional') {
        plan.conditionalBranches.push({
          operatorId: operator.id,
          outputs: outputs.slice(),
        });
      }
      if (operator.type === 'loop') {
        plan.loopBoundaries.push({
          operatorId: operator.id,
          inputs: inputs.slice(),
        });
      }
    }

    return plan;
  }
}

export function createDefaultOperatorRegistry(): OperatorInterpreterRegistry {
  const registry = new OperatorInterpreterRegistry();
  registry.registerAll(DEFAULT_OPERATOR_INTERPRETERS);
  return registry;
}

export function getOperatorInputIds(operator: TechniqueOperator): string[] {
  return operator.inputs?.slice() ?? [];
}
