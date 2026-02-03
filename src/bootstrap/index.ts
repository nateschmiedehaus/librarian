/**
 * @fileoverview Bootstrap Module Exports
 *
 * Provides tiered bootstrap functionality for fast startup with progressive
 * feature enablement.
 *
 * @packageDocumentation
 */

// Tiered Bootstrap
export {
  TieredBootstrap,
  createTieredBootstrap,
  BootstrapTier,
  FEATURES,
  TIER_FEATURES,
} from './tiered_bootstrap.js';

export type {
  TieredBootstrapOptions,
  TierStats,
  BootstrapStatus,
  DiscoveredFile,
  ExtractedSymbol,
  ImportEdge,
  FeatureId,
} from './tiered_bootstrap.js';
