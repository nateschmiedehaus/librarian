/**
 * @fileoverview Homeostasis Module
 *
 * Autonomous system maintenance through the MAPE-K control loop.
 *
 * @packageDocumentation
 */

// Triggers
export {
  TriggerWiring,
  createTriggerWiring,
  DEFAULT_TRIGGER_CONFIG,
  type TriggerConfig,
  type TriggerSource,
  type TriggerUrgency,
  type TriggeredHealthCheck,
  type TriggerCallback,
} from './triggers.js';

// Daemon
export {
  HomeostasisDaemon,
  createHomeostasisDaemon,
  type HomeostasisDaemonConfig,
  type HealingRecord,
  type ActionRecord,
  type DaemonStatus,
} from './daemon.js';
