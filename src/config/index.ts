/**
 * @fileoverview Librarian Configuration Presets
 *
 * Configuration presets for different use cases:
 * - `full_mode`: Maximum capability, all features enabled
 * - (future) `fast_mode`: Quick iteration, minimal LLM calls
 * - (future) `minimal_mode`: MVP indexing, no LLM enrichment
 */

// Full mode - maximum capability configuration
export {
  FULL_MODE_CONFIG,
  FULL_MODE_BOOTSTRAP_CONFIG,
  FULL_MODE_GOVERNOR_CONFIG,
  FULL_MODE_CONTEXT_LEVEL,
  FULL_MODE_ANALYSIS_CONFIG,
  FULL_MODE_TDD_CONFIG,
  createFullModeConfig,
  type FullModeAnalysisConfig,
  type FullModeTddConfig,
} from './full_mode.js';
