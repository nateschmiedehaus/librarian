/**
 * @fileoverview UCB1 Bandit for Emitter Allocation
 *
 * Implements Upper Confidence Bound (UCB1) algorithm for
 * efficient allocation of evaluation budget across emitters.
 * Now supports multi-component reward signal for better gradient.
 *
 * @packageDocumentation
 */

import type { BanditState, EmitterStats, Emitter } from './types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  RewardSignalCalculator,
  createRewardSignalCalculator,
  type RewardInput,
  type RewardResult,
} from './reward_signal.js';

// ============================================================================
// UCB1 BANDIT
// ============================================================================

/**
 * UCB1 bandit for emitter selection.
 */
export class UCB1Bandit {
  private totalTrials = 0;
  private emitterStats: Map<string, EmitterStats> = new Map();
  private readonly explorationConstant: number;
  private readonly statePath: string;
  private readonly rewardCalculator: RewardSignalCalculator;
  private readonly useMultiComponentReward: boolean;

  constructor(options: {
    explorationConstant?: number;
    statePath?: string;
    rewardCalculator?: RewardSignalCalculator;
    useMultiComponentReward?: boolean;
  } = {}) {
    this.explorationConstant = options.explorationConstant ?? Math.sqrt(2);
    this.statePath = options.statePath ?? 'state/audits/evolution/bandit_state.json';
    this.rewardCalculator = options.rewardCalculator ?? createRewardSignalCalculator();
    this.useMultiComponentReward = options.useMultiComponentReward ?? true;
  }

  // ==========================================================================
  // EMITTER SELECTION
  // ==========================================================================

  /**
   * Select the next emitter using UCB1.
   */
  selectEmitter(emitters: Emitter[]): Emitter {
    // Ensure all emitters have stats
    for (const emitter of emitters) {
      if (!this.emitterStats.has(emitter.id)) {
        this.emitterStats.set(emitter.id, {
          emitterId: emitter.id,
          totalTrials: 0,
          successfulImprovements: 0,
          totalReward: 0,
          avgReward: 0,
          lastUsed: new Date().toISOString(),
        });
      }
    }

    // First, try each emitter at least once
    for (const emitter of emitters) {
      const stats = this.emitterStats.get(emitter.id)!;
      if (stats.totalTrials === 0) {
        return emitter;
      }
    }

    // Calculate UCB1 score for each emitter
    let bestEmitter: Emitter | null = null;
    let bestScore = -Infinity;

    for (const emitter of emitters) {
      const stats = this.emitterStats.get(emitter.id)!;
      const score = this.calculateUCB1Score(stats);

      if (score > bestScore) {
        bestScore = score;
        bestEmitter = emitter;
      }
    }

    return bestEmitter ?? emitters[0];
  }

  /**
   * Calculate UCB1 score for an emitter.
   */
  private calculateUCB1Score(stats: EmitterStats): number {
    if (stats.totalTrials === 0) {
      return Infinity; // Force exploration of untried arms
    }

    const exploitation = stats.avgReward;
    const exploration = this.explorationConstant * Math.sqrt(
      Math.log(this.totalTrials + 1) / stats.totalTrials
    );

    return exploitation + exploration;
  }

  // ==========================================================================
  // REWARD RECORDING
  // ==========================================================================

  /**
   * Record the result of an emitter trial.
   */
  recordTrial(emitterId: string, reward: number, improved: boolean): void {
    this.totalTrials++;

    const stats = this.emitterStats.get(emitterId);
    if (!stats) {
      // Create new stats if missing
      this.emitterStats.set(emitterId, {
        emitterId,
        totalTrials: 1,
        successfulImprovements: improved ? 1 : 0,
        totalReward: reward,
        avgReward: reward,
        lastUsed: new Date().toISOString(),
      });
      return;
    }

    stats.totalTrials++;
    stats.totalReward += reward;
    stats.avgReward = stats.totalReward / stats.totalTrials;
    stats.lastUsed = new Date().toISOString();

    if (improved) {
      stats.successfulImprovements++;
    }
  }

  /**
   * Compute reward from fitness delta.
   *
   * Uses multi-component reward signal if enabled, providing meaningful
   * gradient even when baseline fitness is zero.
   */
  computeReward(
    fitnessDelta: number,
    cost: { tokens: number; embeddings: number },
    options?: {
      fitnessBefore?: number;
      fitnessAfter?: number;
      novelty?: number;
      coverageContribution?: number;
      behaviorDescriptor?: number[];
    }
  ): number {
    if (this.useMultiComponentReward && options?.fitnessBefore !== undefined) {
      // Use multi-component reward calculator
      const result = this.rewardCalculator.compute({
        fitnessBefore: options.fitnessBefore,
        fitnessAfter: options.fitnessAfter ?? options.fitnessBefore + fitnessDelta,
        novelty: options.novelty,
        coverageContribution: options.coverageContribution,
        behaviorDescriptor: options.behaviorDescriptor,
        resourcesUsed: {
          tokens: cost.tokens,
          time: cost.embeddings * 100, // Estimate time from embeddings
        },
      });

      // Record historical usage for normalization
      this.rewardCalculator.recordHistoricalUsage({
        tokens: cost.tokens,
        time: cost.embeddings * 100,
      });

      return result.total;
    }

    // Fallback to simple reward computation
    const normalizedImprovement = Math.max(0, fitnessDelta);
    const costPenalty = (cost.tokens / 100000) + (cost.embeddings / 1000);
    const normalizedCost = 1 / (1 + costPenalty);
    return normalizedImprovement * normalizedCost;
  }

  /**
   * Compute detailed reward with full breakdown.
   */
  computeDetailedReward(input: RewardInput): RewardResult {
    return this.rewardCalculator.compute(input);
  }

  /**
   * Get the reward calculator for external access.
   */
  getRewardCalculator(): RewardSignalCalculator {
    return this.rewardCalculator;
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get stats for all emitters.
   */
  getStats(): EmitterStats[] {
    return Array.from(this.emitterStats.values());
  }

  /**
   * Get stats for a specific emitter.
   */
  getEmitterStats(emitterId: string): EmitterStats | null {
    return this.emitterStats.get(emitterId) ?? null;
  }

  /**
   * Get the best performing emitter.
   */
  getBestEmitter(): string | null {
    let best: EmitterStats | null = null;

    for (const stats of this.emitterStats.values()) {
      if (!best || stats.avgReward > best.avgReward) {
        best = stats;
      }
    }

    return best?.emitterId ?? null;
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Save bandit state to disk.
   */
  async save(basePath?: string): Promise<void> {
    const filePath = basePath
      ? path.join(basePath, 'bandit_state.json')
      : this.statePath;

    const state: BanditState = {
      kind: 'UCB1BanditState.v1',
      schemaVersion: 1,
      totalTrials: this.totalTrials,
      emitterStats: this.getStats(),
      explorationConstant: this.explorationConstant,
    };

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  /**
   * Load bandit state from disk.
   */
  async load(basePath?: string): Promise<boolean> {
    const filePath = basePath
      ? path.join(basePath, 'bandit_state.json')
      : this.statePath;

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const state = JSON.parse(raw) as BanditState;

      if (state.kind !== 'UCB1BanditState.v1') {
        return false;
      }

      this.totalTrials = state.totalTrials;
      this.emitterStats.clear();

      for (const stats of state.emitterStats) {
        this.emitterStats.set(stats.emitterId, stats);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset bandit state.
   */
  reset(): void {
    this.totalTrials = 0;
    this.emitterStats.clear();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBandit(
  options?: { explorationConstant?: number; statePath?: string }
): UCB1Bandit {
  return new UCB1Bandit(options);
}
