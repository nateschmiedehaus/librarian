/**
 * @fileoverview Unified Librarian Orchestrator Module
 *
 * This module provides the PRIMARY entry point for AI agents to use Librarian.
 * A single function call sets up everything needed for optimal codebase understanding.
 *
 * @example
 * ```typescript
 * import { initializeLibrarian } from 'librarian/orchestrator';
 *
 * // One function call does everything
 * const session = await initializeLibrarian('/path/to/workspace');
 *
 * // Query the codebase
 * const context = await session.query('How does authentication work?');
 *
 * // Record outcomes for calibration
 * await session.recordOutcome({ success: true, packIds: context.packIds });
 *
 * // Check health
 * const health = session.health();
 * ```
 *
 * @packageDocumentation
 */

export {
  // Main entry point
  initializeLibrarian,

  // Session management
  hasSession,
  getSession,
  shutdownAllSessions,
  getActiveSessionCount,

  // Types
  type LibrarianSession,
  type TaskResult,
  type HealthReport,
  type Context,
  type InitializeOptions,
  type QueryOptions,
} from './unified_init.js';
