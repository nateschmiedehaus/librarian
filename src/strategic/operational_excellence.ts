/**
 * @fileoverview Operational Excellence Framework for World-Class Software Systems
 *
 * This module provides comprehensive operational excellence patterns including:
 *
 * 1. **Observability Standards** - Logging, metrics, tracing, and alerting
 * 2. **Reliability Engineering** - Incident response, post-mortems, capacity planning
 * 3. **Deployment Excellence** - Pipeline, feature flags, rollback strategies
 * 4. **Security Operations** - Vulnerability management, secrets, access control
 *
 * Design Philosophy:
 * - Evidence-based operations with full auditability
 * - Proactive reliability through SLOs and error budgets
 * - Security as a first-class operational concern
 * - Continuous improvement through blameless post-mortems
 *
 * @packageDocumentation
 */

import type { ConfidenceAssessment } from './types.js';

// ============================================================================
// OBSERVABILITY STANDARDS
// ============================================================================

/**
 * Complete observability configuration for production systems
 */
export interface ObservabilityConfig {
  logging: LoggingConfig;
  metrics: MetricsConfig;
  tracing: TracingConfig;
  alerting: AlertingConfig;
}

/**
 * Logging configuration for structured observability
 */
export interface LoggingConfig {
  /** Log format - structured for machine parsing, text for human readability */
  format: 'structured' | 'text';

  /** Enabled log levels */
  levels: ('debug' | 'info' | 'warn' | 'error')[];

  /** Log retention period in days */
  retentionDays: number;

  /** Fields required in every log entry */
  requiredFields: string[]; // e.g., ['correlationId', 'timestamp', 'service']

  /** Strategy for handling personally identifiable information */
  piiHandling: 'redact' | 'hash' | 'exclude';

  /** Maximum log message size in bytes */
  maxMessageSize?: number;

  /** Log sampling rate for high-volume scenarios (0-1) */
  samplingRate?: number;

  /** Log destinations */
  destinations?: LogDestination[];
}

export interface LogDestination {
  type: 'stdout' | 'file' | 'elasticsearch' | 'cloudwatch' | 'datadog' | 'custom';
  config: Record<string, unknown>;
  enabled: boolean;
}

/**
 * Metrics configuration including SLIs and SLOs
 */
export interface MetricsConfig {
  /** Service Level Indicators */
  slis: ServiceLevelIndicator[];

  /** Service Level Objectives */
  slos: ServiceLevelObjective[];

  /** Error budget configuration */
  errorBudget: ErrorBudgetConfig;

  /** Whether dashboards are required for deployment */
  dashboardRequired: boolean;

  /** Custom metrics to track */
  customMetrics?: CustomMetric[];

  /** Metrics export configuration */
  exportConfig?: MetricsExportConfig;
}

/**
 * Service Level Indicator - quantitative measure of service behavior
 */
export interface ServiceLevelIndicator {
  /** Unique name for this SLI */
  name: string;

  /** Type of measurement */
  type: 'availability' | 'latency' | 'throughput' | 'error_rate' | 'saturation' | 'freshness';

  /** How this SLI is measured (query, expression, or description) */
  measurement: string;

  /** Unit of measurement */
  unit?: string;

  /** Description of what this SLI measures */
  description?: string;

  /** Data source for this SLI */
  dataSource?: string;
}

/**
 * Service Level Objective - target value for an SLI
 */
export interface ServiceLevelObjective {
  /** Reference to the SLI name */
  sliName: string;

  /** Target value (percentage or absolute) */
  target: number;

  /** Time window for evaluation */
  window: 'rolling_7d' | 'rolling_30d' | 'calendar_month' | 'calendar_quarter';

  /** Burn rate alert thresholds */
  burnRateThresholds?: BurnRateThreshold[];

  /** Description of consequences if not met */
  consequence?: string;
}

export interface BurnRateThreshold {
  /** Burn rate multiplier (e.g., 14x means 14 times normal budget consumption) */
  rate: number;

  /** How long the burn rate must persist before alerting */
  windowMinutes: number;

  /** Alert severity */
  severity: 'warning' | 'critical' | 'page';
}

/**
 * Error budget configuration for reliability management
 */
export interface ErrorBudgetConfig {
  /** How the budget is calculated */
  calculation: 'one_minus_slo' | 'explicit';

  /** Explicit budget value if calculation is 'explicit' */
  explicitValue?: number;

  /** Actions when budget thresholds are crossed */
  thresholdActions: ErrorBudgetThresholdAction[];

  /** Budget reset schedule */
  resetSchedule: 'monthly' | 'quarterly' | 'rolling';

  /** Whether to track budget consumption velocity */
  trackVelocity: boolean;
}

export interface ErrorBudgetThresholdAction {
  /** Budget remaining percentage (e.g., 50 = 50% remaining) */
  thresholdPercent: number;

  /** Actions to take */
  actions: ErrorBudgetAction[];
}

export type ErrorBudgetAction =
  | { type: 'notify'; channels: string[] }
  | { type: 'freeze_deployments' }
  | { type: 'reduce_change_velocity'; factor: number }
  | { type: 'require_additional_review' }
  | { type: 'escalate'; to: string[] }
  | { type: 'custom'; handler: string };

export interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  labels: string[];
  unit?: string;
}

export interface MetricsExportConfig {
  format: 'prometheus' | 'opentelemetry' | 'statsd' | 'cloudwatch';
  endpoint?: string;
  intervalSeconds: number;
  batchSize?: number;
}

/**
 * Distributed tracing configuration
 */
export interface TracingConfig {
  /** Whether tracing is enabled */
  enabled: boolean;

  /** Sampling strategy */
  samplingStrategy: 'always' | 'never' | 'probabilistic' | 'rate_limiting' | 'parent_based';

  /** Sampling rate for probabilistic sampling (0-1) */
  samplingRate?: number;

  /** Rate limit for rate_limiting strategy (traces per second) */
  rateLimit?: number;

  /** Propagation formats supported */
  propagationFormats: ('w3c' | 'b3' | 'jaeger' | 'xray')[];

  /** Trace exporter configuration */
  exporter: TraceExporterConfig;

  /** Span attributes to always include */
  requiredAttributes?: string[];

  /** Maximum spans per trace */
  maxSpansPerTrace?: number;
}

export interface TraceExporterConfig {
  type: 'jaeger' | 'zipkin' | 'otlp' | 'xray' | 'datadog' | 'console';
  endpoint?: string;
  headers?: Record<string, string>;
  compression?: 'none' | 'gzip';
}

/**
 * Alerting configuration for proactive incident detection
 */
export interface AlertingConfig {
  /** Alert routing rules */
  routes: AlertRoute[];

  /** Default notification channels */
  defaultChannels: string[];

  /** Alert suppression rules */
  suppressionRules?: AlertSuppressionRule[];

  /** Escalation policies */
  escalationPolicies: EscalationPolicy[];

  /** On-call schedule integration */
  onCallIntegration?: OnCallConfig;

  /** Alert deduplication settings */
  deduplication?: AlertDeduplicationConfig;
}

export interface AlertRoute {
  /** Matcher for alert labels (empty or omitted means match all) */
  match?: Record<string, string>;

  /** Notification channels for matching alerts */
  channels: string[];

  /** Whether to continue checking subsequent routes */
  continue: boolean;

  /** Group by these labels for batching */
  groupBy?: string[];

  /** Wait time before sending first notification */
  groupWaitSeconds?: number;

  /** Wait time between notifications for the same group */
  groupIntervalSeconds?: number;
}

export interface AlertSuppressionRule {
  /** Source alert that triggers suppression */
  sourceMatch: Record<string, string>;

  /** Alerts to suppress when source fires */
  targetMatch: Record<string, string>;

  /** Duration to suppress in seconds */
  durationSeconds: number;
}

export interface EscalationPolicy {
  name: string;
  steps: EscalationStep[];
  repeatEnabled: boolean;
  repeatIntervalMinutes?: number;
}

export interface EscalationStep {
  /** Order in escalation chain */
  order: number;

  /** Wait time before escalating to next step (minutes) */
  delayMinutes: number;

  /** Targets to notify at this step */
  targets: EscalationTarget[];
}

export interface EscalationTarget {
  type: 'user' | 'team' | 'schedule' | 'channel';
  id: string;
  method?: 'email' | 'sms' | 'push' | 'slack' | 'pagerduty';
}

export interface OnCallConfig {
  provider: 'pagerduty' | 'opsgenie' | 'victorops' | 'custom';
  scheduleId: string;
  apiEndpoint?: string;
}

export interface AlertDeduplicationConfig {
  /** Key fields for deduplication */
  keyFields: string[];

  /** Time window for deduplication */
  windowMinutes: number;

  /** Whether to increment count for deduplicated alerts */
  trackCount: boolean;
}

// ============================================================================
// RELIABILITY ENGINEERING
// ============================================================================

/**
 * Complete reliability engineering configuration
 */
export interface ReliabilityConfig {
  incidentResponse: IncidentResponseConfig;
  postMortemTemplate: PostMortemTemplate;
  capacityPlanning: CapacityPlanningConfig;
  disasterRecovery: DisasterRecoveryConfig;
}

/**
 * Incident response configuration
 */
export interface IncidentResponseConfig {
  /** Severity level definitions */
  severityLevels: SeverityLevel[];

  /** Escalation policy */
  escalationPolicy: EscalationStep[];

  /** Communication channels for incidents */
  communicationChannels: string[];

  /** Whether runbooks are required for all alerts */
  runbookRequired: boolean;

  /** Incident commander rotation */
  icRotation?: RotationConfig;

  /** Automated response actions */
  automatedResponses?: AutomatedResponse[];

  /** Status page configuration */
  statusPage?: StatusPageConfig;
}

export interface SeverityLevel {
  /** Severity identifier (e.g., 'sev1', 'critical', 'P1') */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of this severity level */
  description: string;

  /** Response time SLA in minutes */
  responseTimeMinutes: number;

  /** Resolution time target in minutes */
  resolutionTargetMinutes: number;

  /** Whether this severity pages on-call */
  pagesOnCall: boolean;

  /** Required responders */
  requiredResponders?: string[];

  /** Example scenarios */
  examples?: string[];
}

export interface RotationConfig {
  type: 'weekly' | 'daily' | 'custom';
  participants: string[];
  handoffTime?: string; // e.g., '09:00 UTC'
  customSchedule?: RotationScheduleEntry[];
}

export interface RotationScheduleEntry {
  participant: string;
  startTime: string;
  endTime: string;
}

export interface AutomatedResponse {
  /** Trigger condition */
  trigger: AutomatedResponseTrigger;

  /** Actions to execute */
  actions: AutomatedResponseAction[];

  /** Whether human approval is required */
  requiresApproval: boolean;

  /** Maximum times to retry */
  maxRetries: number;
}

export interface AutomatedResponseTrigger {
  type: 'alert' | 'metric_threshold' | 'error_rate' | 'latency_spike';
  condition: Record<string, unknown>;
}

export type AutomatedResponseAction =
  | { type: 'scale_up'; target: string; amount: number }
  | { type: 'scale_down'; target: string; amount: number }
  | { type: 'restart_service'; service: string }
  | { type: 'failover'; from: string; to: string }
  | { type: 'circuit_break'; service: string }
  | { type: 'rollback'; version?: string }
  | { type: 'run_runbook'; runbookId: string }
  | { type: 'notify'; channels: string[] }
  | { type: 'custom'; handler: string; params?: Record<string, unknown> };

export interface StatusPageConfig {
  provider: 'statuspage' | 'cachet' | 'custom';
  autoUpdate: boolean;
  components: StatusPageComponent[];
}

export interface StatusPageComponent {
  id: string;
  name: string;
  description?: string;
  group?: string;
}

/**
 * Post-mortem template configuration
 */
export interface PostMortemTemplate {
  /** Required sections in post-mortem */
  sections: PostMortemSection[];

  /** Whether post-mortems are blameless */
  blameless: boolean;

  /** Whether review is required before publishing */
  reviewRequired: boolean;

  /** Whether to publish internally */
  publishInternal: boolean;

  /** Publishing cadence requirement */
  publishDeadlineHours?: number;

  /** Custom fields for post-mortem */
  customFields?: PostMortemCustomField[];
}

export type PostMortemSection =
  | 'timeline'
  | 'impact'
  | 'root_cause'
  | 'contributing_factors'
  | 'action_items'
  | 'lessons_learned'
  | 'detection'
  | 'response'
  | 'recovery'
  | 'prevention';

export interface PostMortemCustomField {
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'date';
  required: boolean;
  options?: string[]; // For select/multiselect
}

/**
 * Capacity planning configuration
 */
export interface CapacityPlanningConfig {
  /** Metrics to track for capacity */
  capacityMetrics: CapacityMetric[];

  /** Planning horizon in days */
  planningHorizonDays: number;

  /** Buffer percentage above projected needs */
  bufferPercent: number;

  /** Scaling thresholds */
  scalingThresholds: ScalingThreshold[];

  /** Review cadence */
  reviewCadence: 'weekly' | 'monthly' | 'quarterly';

  /** Cost tracking enabled */
  costTrackingEnabled: boolean;
}

export interface CapacityMetric {
  name: string;
  resource: 'cpu' | 'memory' | 'storage' | 'network' | 'connections' | 'custom';
  currentValue: number;
  unit: string;
  maxValue: number;
  projectionModel?: 'linear' | 'exponential' | 'seasonal';
}

export interface ScalingThreshold {
  metric: string;
  warnThreshold: number;
  criticalThreshold: number;
  scaleUpAction?: string;
  cooldownMinutes: number;
}

/**
 * Disaster recovery configuration
 */
export interface DisasterRecoveryConfig {
  /** Recovery Time Objective in minutes */
  rtoMinutes: number;

  /** Recovery Point Objective in minutes */
  rpoMinutes: number;

  /** Backup configuration */
  backupConfig: BackupConfig;

  /** Failover configuration */
  failoverConfig: FailoverConfig;

  /** DR test schedule */
  testSchedule: DRTestSchedule;

  /** Runbook for DR procedures */
  drRunbookId?: string;
}

export interface BackupConfig {
  /** Backup frequency */
  frequency: 'continuous' | 'hourly' | 'daily' | 'weekly';

  /** Retention periods */
  retention: BackupRetention;

  /** Backup destinations */
  destinations: BackupDestination[];

  /** Encryption configuration */
  encryption: BackupEncryption;

  /** Verification settings */
  verification: BackupVerification;
}

export interface BackupRetention {
  hourlyBackups?: number;
  dailyBackups: number;
  weeklyBackups: number;
  monthlyBackups: number;
  yearlyBackups?: number;
}

export interface BackupDestination {
  type: 'local' | 's3' | 'gcs' | 'azure' | 'glacier';
  location: string;
  tier: 'hot' | 'warm' | 'cold';
}

export interface BackupEncryption {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20';
  keyManagement: 'kms' | 'vault' | 'local';
}

export interface BackupVerification {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  verifyIntegrity: boolean;
  testRestore: boolean;
}

export interface FailoverConfig {
  /** Failover mode */
  mode: 'active_passive' | 'active_active' | 'pilot_light' | 'warm_standby';

  /** Automatic failover enabled */
  automaticFailover: boolean;

  /** Failover trigger conditions */
  triggers: FailoverTrigger[];

  /** Health check configuration */
  healthCheck: HealthCheckConfig;

  /** DNS failover configuration */
  dnsConfig?: DNSFailoverConfig;
}

export interface FailoverTrigger {
  condition: 'health_check_failure' | 'region_outage' | 'manual' | 'metric_threshold';
  threshold?: number;
  consecutiveFailures?: number;
}

export interface HealthCheckConfig {
  endpoint: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface DNSFailoverConfig {
  provider: 'route53' | 'cloudflare' | 'akamai' | 'custom';
  ttlSeconds: number;
  healthCheckId?: string;
}

export interface DRTestSchedule {
  frequency: 'monthly' | 'quarterly' | 'biannually' | 'annually';
  type: 'tabletop' | 'simulation' | 'full_failover';
  lastTest?: string;
  nextTest?: string;
  requiredParticipants: string[];
}

// ============================================================================
// DEPLOYMENT EXCELLENCE
// ============================================================================

/**
 * Complete deployment configuration
 */
export interface DeploymentConfig {
  pipeline: PipelineConfig;
  strategy: DeploymentStrategy;
  featureFlags: FeatureFlagConfig;
  rollback: RollbackConfig;
}

export type DeploymentStrategy = 'blue_green' | 'canary' | 'rolling' | 'recreate' | 'shadow';

/**
 * CI/CD pipeline configuration
 */
export interface PipelineConfig {
  /** Pipeline stages */
  stages: PipelineStage[];

  /** Required quality gates */
  qualityGates: QualityGate[];

  /** Environment progression */
  environments: EnvironmentConfig[];

  /** Approval requirements */
  approvals: ApprovalConfig[];

  /** Artifact management */
  artifacts: ArtifactConfig;
}

export interface PipelineStage {
  name: string;
  type: 'build' | 'test' | 'security' | 'deploy' | 'verify' | 'custom';
  required: boolean;
  timeout: number;
  retries: number;
  dependsOn?: string[];
  steps?: PipelineStep[];
}

export interface PipelineStep {
  name: string;
  command: string;
  environment?: Record<string, string>;
  continueOnError?: boolean;
}

export interface QualityGate {
  name: string;
  type: 'test_coverage' | 'security_scan' | 'lint' | 'performance' | 'manual' | 'custom';
  threshold?: number;
  blocking: boolean;
  allowOverride: boolean;
  overrideApprovers?: string[];
}

export interface EnvironmentConfig {
  name: string;
  type: 'development' | 'staging' | 'production' | 'dr';
  autoPromote: boolean;
  promotionGates?: string[];
  protectedBranches?: string[];
}

export interface ApprovalConfig {
  stage: string;
  requiredApprovers: number;
  approverGroups: string[];
  timeoutHours: number;
  autoApproveFor?: string[]; // Environments that auto-approve
}

export interface ArtifactConfig {
  registry: string;
  retention: {
    production: number;
    staging: number;
    development: number;
  };
  signing: boolean;
  scanEnabled: boolean;
}

/**
 * Feature flag configuration
 */
export interface FeatureFlagConfig {
  /** Feature flag provider */
  provider: 'launchdarkly' | 'split' | 'flagsmith' | 'unleash' | 'custom';

  /** Default flag state */
  defaultState: 'on' | 'off' | 'percentage';

  /** Targeting rules */
  targetingRules: TargetingRule[];

  /** Stale flag cleanup policy */
  stalePolicy: StaleFlagPolicy;

  /** Audit logging for flag changes */
  auditEnabled: boolean;

  /** Flag lifecycle management */
  lifecycle: FlagLifecycleConfig;
}

export interface TargetingRule {
  name: string;
  attribute: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'percentage';
  value: unknown;
  rolloutPercentage?: number;
}

export interface StaleFlagPolicy {
  enabled: boolean;
  staleAfterDays: number;
  action: 'notify' | 'disable' | 'remove';
  notifyChannels?: string[];
}

export interface FlagLifecycleConfig {
  requireDescription: boolean;
  requireOwner: boolean;
  requireExpiryDate: boolean;
  maxLifetimeDays?: number;
}

/**
 * Rollback configuration
 */
export interface RollbackConfig {
  /** Automatic rollback enabled */
  automatic: boolean;

  /** Conditions that trigger rollback */
  triggers: RollbackTrigger[];

  /** Maximum time to complete rollback in seconds */
  maxRollbackTime: number;

  /** Strategy for handling data changes during rollback */
  dataRollbackStrategy: 'none' | 'restore' | 'compensate';

  /** Number of previous versions to keep for rollback */
  versionRetention: number;

  /** Notification channels for rollback events */
  notifyChannels?: string[];

  /** Post-rollback verification */
  verification?: RollbackVerification;
}

export interface RollbackTrigger {
  type: 'error_rate' | 'latency' | 'health_check' | 'slo_breach' | 'manual' | 'custom';
  threshold?: number;
  evaluationWindowSeconds?: number;
  consecutiveFailures?: number;
  customCondition?: string;
}

export interface RollbackVerification {
  enabled: boolean;
  healthCheckEndpoint: string;
  successCriteria: SuccessCriterion[];
  timeoutSeconds: number;
}

export interface SuccessCriterion {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value: number;
}

// ============================================================================
// SECURITY OPERATIONS
// ============================================================================

/**
 * Complete security operations configuration
 */
export interface SecOpsConfig {
  vulnerabilityManagement: VulnerabilityConfig;
  secretsManagement: SecretsConfig;
  accessControl: AccessControlConfig;
  auditLogging: AuditConfig;
}

/**
 * Vulnerability management configuration
 */
export interface VulnerabilityConfig {
  /** Vulnerability scanning configuration */
  scanning: VulnerabilityScanConfig;

  /** SLA for vulnerability remediation */
  remediationSLA: RemediationSLA;

  /** Exception handling */
  exceptionPolicy: ExceptionPolicy;

  /** Integration with ticketing systems */
  ticketingIntegration?: TicketingIntegration;
}

export interface VulnerabilityScanConfig {
  /** Scan frequency */
  frequency: 'continuous' | 'daily' | 'weekly' | 'on_deploy';

  /** Scan types enabled */
  scanTypes: VulnerabilityScanType[];

  /** Block deployment on findings */
  blockOnSeverity: 'critical' | 'high' | 'medium' | 'low' | 'none';

  /** Scanners to use */
  scanners: ScannerConfig[];
}

export type VulnerabilityScanType =
  | 'dependency'
  | 'container'
  | 'sast'
  | 'dast'
  | 'infrastructure'
  | 'secrets';

export interface ScannerConfig {
  name: string;
  type: VulnerabilityScanType;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface RemediationSLA {
  critical: { hours: number; escalateAfterHours: number };
  high: { hours: number; escalateAfterHours: number };
  medium: { hours: number; escalateAfterHours: number };
  low: { hours: number; escalateAfterHours: number };
}

export interface ExceptionPolicy {
  allowExceptions: boolean;
  maxExceptionDays: number;
  requiredApprovers: number;
  requireJustification: boolean;
  reviewCadence: 'weekly' | 'monthly' | 'quarterly';
}

export interface TicketingIntegration {
  provider: 'jira' | 'servicenow' | 'github' | 'linear' | 'custom';
  autoCreate: boolean;
  projectKey: string;
  assignmentRules: AssignmentRule[];
}

export interface AssignmentRule {
  severity: 'critical' | 'high' | 'medium' | 'low';
  assignTo: string;
  labels?: string[];
  priority?: string;
}

/**
 * Secrets management configuration
 */
export interface SecretsConfig {
  /** Secrets provider */
  provider: 'vault' | 'aws_secrets_manager' | 'gcp_secret_manager' | 'azure_keyvault' | 'doppler';

  /** Rotation policy */
  rotationPolicy: RotationPolicy;

  /** Secret categories and their policies */
  categories: SecretCategory[];

  /** Access policy */
  accessPolicy: SecretAccessPolicy;

  /** Audit configuration */
  audit: SecretAuditConfig;
}

export interface RotationPolicy {
  enabled: boolean;
  defaultIntervalDays: number;
  gracePeriodHours: number;
  notifyBeforeDays: number;
}

export interface SecretCategory {
  name: string;
  pattern: string; // Regex pattern for matching secret names
  rotationIntervalDays: number;
  accessLevel: 'restricted' | 'team' | 'service' | 'public';
  encryptionRequired: boolean;
}

export interface SecretAccessPolicy {
  requireMFA: boolean;
  maxAccessDuration: number; // seconds
  justInTimeAccess: boolean;
  approvalRequired: boolean;
  allowedServices: string[];
}

export interface SecretAuditConfig {
  logAccess: boolean;
  logRotation: boolean;
  alertOnAnomalousAccess: boolean;
  retentionDays: number;
}

/**
 * Access control configuration
 */
export interface AccessControlConfig {
  /** Authentication configuration */
  authentication: AuthenticationConfig;

  /** Authorization configuration */
  authorization: AuthorizationConfig;

  /** Access review configuration */
  accessReview: AccessReviewConfig;
}

export interface AuthenticationConfig {
  /** Supported authentication methods */
  methods: AuthMethod[];

  /** MFA requirements */
  mfaPolicy: MFAPolicy;

  /** Session configuration */
  session: SessionConfig;

  /** Password policy (if applicable) */
  passwordPolicy?: PasswordPolicy;
}

export interface AuthMethod {
  type: 'sso' | 'oidc' | 'saml' | 'api_key' | 'mtls' | 'password';
  enabled: boolean;
  provider?: string;
  config: Record<string, unknown>;
}

export interface MFAPolicy {
  required: boolean;
  methods: ('totp' | 'webauthn' | 'sms' | 'email' | 'push')[];
  gracePeriodDays?: number;
  rememberDeviceDays?: number;
}

export interface SessionConfig {
  maxDurationHours: number;
  idleTimeoutMinutes: number;
  concurrentSessions: number | 'unlimited';
  requireReauthForSensitive: boolean;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number;
  maxAgeDays: number;
}

export interface AuthorizationConfig {
  /** Authorization model */
  model: 'rbac' | 'abac' | 'pbac' | 'rebac';

  /** Role definitions */
  roles: RoleDefinition[];

  /** Permission definitions */
  permissions: PermissionDefinition[];

  /** Policy enforcement point */
  enforcement: 'gateway' | 'service' | 'both';
}

export interface RoleDefinition {
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[];
  constraints?: RoleConstraint[];
}

export interface RoleConstraint {
  type: 'time' | 'location' | 'resource' | 'custom';
  condition: Record<string, unknown>;
}

export interface PermissionDefinition {
  name: string;
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'execute' | 'admin')[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  attribute: string;
  operator: 'equals' | 'contains' | 'in' | 'matches';
  value: unknown;
}

export interface AccessReviewConfig {
  enabled: boolean;
  frequency: 'monthly' | 'quarterly' | 'annually';
  reviewers: string[];
  autoRevoke: boolean;
  reminderDays: number[];
}

/**
 * Audit logging configuration
 */
export interface AuditConfig {
  /** Events to audit */
  auditedEvents: AuditedEvent[];

  /** Audit log destination */
  destination: AuditDestination;

  /** Retention policy */
  retention: AuditRetention;

  /** Tamper protection */
  tamperProtection: TamperProtectionConfig;

  /** Alert rules for audit events */
  alertRules: AuditAlertRule[];
}

export interface AuditedEvent {
  category: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'security' | 'system';
  events: string[];
  includePayload: boolean;
  sensitiveFields?: string[]; // Fields to redact
}

export interface AuditDestination {
  type: 'elasticsearch' | 'splunk' | 's3' | 'cloudwatch' | 'bigquery' | 'custom';
  config: Record<string, unknown>;
  replication?: AuditReplication;
}

export interface AuditReplication {
  enabled: boolean;
  destinations: AuditDestination[];
  delay?: number; // Replication delay in seconds
}

export interface AuditRetention {
  hotStorageDays: number;
  warmStorageDays: number;
  coldStorageDays: number;
  deleteAfterDays: number;
}

export interface TamperProtectionConfig {
  enabled: boolean;
  method: 'blockchain' | 'merkle_tree' | 'hash_chain' | 'write_once';
  verificationFrequency: 'hourly' | 'daily' | 'weekly';
}

export interface AuditAlertRule {
  name: string;
  condition: AuditAlertCondition;
  severity: 'info' | 'warning' | 'critical';
  channels: string[];
}

export interface AuditAlertCondition {
  eventType: string;
  count?: number;
  windowMinutes?: number;
  pattern?: string;
}

// ============================================================================
// OPERATIONAL EXCELLENCE ASSESSMENT
// ============================================================================

/**
 * Overall operational excellence configuration
 */
export interface OperationalExcellenceConfig {
  observability: ObservabilityConfig;
  reliability: ReliabilityConfig;
  deployment: DeploymentConfig;
  secOps: SecOpsConfig;
  metadata: ConfigMetadata;
}

export interface ConfigMetadata {
  version: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  tags: string[];
}

/**
 * Compliance check result
 */
export interface ComplianceCheckResult {
  passed: boolean;
  overallScore: number;
  categories: ComplianceCategoryResult[];
  criticalIssues: ComplianceIssue[];
  warnings: ComplianceIssue[];
  suggestions: ComplianceIssue[];
  timestamp: string;
}

export interface ComplianceCategoryResult {
  category: 'observability' | 'reliability' | 'deployment' | 'security';
  score: number;
  passed: boolean;
  checks: ComplianceCheck[];
}

export interface ComplianceCheck {
  name: string;
  description: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: string;
}

export interface ComplianceIssue {
  category: string;
  check: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  remediation?: string;
}

/**
 * Health score result
 */
export interface HealthScoreResult {
  overallScore: number;
  confidence: ConfidenceAssessment;
  dimensions: HealthDimensionScore[];
  trend: 'improving' | 'stable' | 'degrading';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: HealthRecommendation[];
  calculatedAt: string;
}

export interface HealthDimensionScore {
  dimension: string;
  score: number;
  weight: number;
  factors: HealthFactor[];
}

export interface HealthFactor {
  name: string;
  score: number;
  evidence: string;
}

export interface HealthRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  recommendation: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

/**
 * Runbook template
 */
export interface RunbookTemplate {
  id: string;
  title: string;
  description: string;
  type: 'incident' | 'deployment' | 'maintenance' | 'recovery' | 'investigation';
  severity?: string;
  tags: string[];
  sections: RunbookSection[];
  metadata: RunbookMetadata;
}

export interface RunbookSection {
  title: string;
  content: string;
  type: 'overview' | 'prerequisites' | 'steps' | 'verification' | 'rollback' | 'escalation' | 'notes';
  steps?: RunbookStep[];
}

export interface RunbookStep {
  order: number;
  description: string;
  command?: string;
  expectedOutput?: string;
  rollbackCommand?: string;
  notes?: string;
  automatable: boolean;
}

export interface RunbookMetadata {
  version: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  relatedAlerts?: string[];
  relatedServices?: string[];
}

// ============================================================================
// COMPLIANCE CHECKER
// ============================================================================

/**
 * Checks operational excellence configuration for compliance
 */
export function checkCompliance(config: OperationalExcellenceConfig): ComplianceCheckResult {
  const now = new Date().toISOString();
  const categories: ComplianceCategoryResult[] = [];
  const criticalIssues: ComplianceIssue[] = [];
  const warnings: ComplianceIssue[] = [];
  const suggestions: ComplianceIssue[] = [];

  // Check observability compliance
  const observabilityChecks = checkObservabilityCompliance(config.observability);
  categories.push(observabilityChecks);
  categorizeIssues(observabilityChecks.checks, 'observability', criticalIssues, warnings, suggestions);

  // Check reliability compliance
  const reliabilityChecks = checkReliabilityCompliance(config.reliability);
  categories.push(reliabilityChecks);
  categorizeIssues(reliabilityChecks.checks, 'reliability', criticalIssues, warnings, suggestions);

  // Check deployment compliance
  const deploymentChecks = checkDeploymentCompliance(config.deployment);
  categories.push(deploymentChecks);
  categorizeIssues(deploymentChecks.checks, 'deployment', criticalIssues, warnings, suggestions);

  // Check security compliance
  const securityChecks = checkSecurityCompliance(config.secOps);
  categories.push(securityChecks);
  categorizeIssues(securityChecks.checks, 'security', criticalIssues, warnings, suggestions);

  const overallScore = categories.reduce((sum, c) => sum + c.score, 0) / categories.length;
  const passed = criticalIssues.length === 0 && overallScore >= 0.7;

  return {
    passed,
    overallScore,
    categories,
    criticalIssues,
    warnings,
    suggestions,
    timestamp: now,
  };
}

function categorizeIssues(
  checks: ComplianceCheck[],
  category: string,
  critical: ComplianceIssue[],
  warnings: ComplianceIssue[],
  suggestions: ComplianceIssue[]
): void {
  for (const check of checks) {
    if (!check.passed) {
      const issue: ComplianceIssue = {
        category,
        check: check.name,
        severity: check.severity,
        message: check.details || `${check.name} check failed`,
      };

      switch (check.severity) {
        case 'critical':
        case 'high':
          critical.push(issue);
          break;
        case 'medium':
          warnings.push(issue);
          break;
        case 'low':
          suggestions.push(issue);
          break;
      }
    }
  }
}

function checkObservabilityCompliance(config: ObservabilityConfig): ComplianceCategoryResult {
  const checks: ComplianceCheck[] = [];

  // Logging checks
  checks.push({
    name: 'Structured logging enabled',
    description: 'Logs should be in structured format for parsing',
    passed: config.logging.format === 'structured',
    severity: 'high',
    details: config.logging.format !== 'structured' ? 'Enable structured logging for better observability' : undefined,
  });

  checks.push({
    name: 'Required log fields configured',
    description: 'Critical fields must be present in all logs',
    passed: config.logging.requiredFields.length >= 3,
    severity: 'medium',
    details: config.logging.requiredFields.length < 3 ? 'Add required fields: correlationId, timestamp, service' : undefined,
  });

  checks.push({
    name: 'PII handling configured',
    description: 'PII must be properly handled in logs',
    passed: config.logging.piiHandling !== undefined,
    severity: 'critical',
  });

  // Metrics checks
  checks.push({
    name: 'SLIs defined',
    description: 'Service Level Indicators should be defined',
    passed: config.metrics.slis.length >= 2,
    severity: 'high',
    details: config.metrics.slis.length < 2 ? 'Define at least 2 SLIs (availability and latency)' : undefined,
  });

  // Check that SLOs reference valid SLIs and there are enough SLOs
  const sliNames = new Set(config.metrics.slis.map((s) => s.name));
  const validSlos = config.metrics.slos.filter((slo) => sliNames.has(slo.sliName));
  checks.push({
    name: 'SLOs defined for SLIs',
    description: 'SLOs should reference defined SLIs with adequate coverage',
    passed: validSlos.length >= 2 && validSlos.length === config.metrics.slos.length,
    severity: 'high',
    details: validSlos.length < 2 ? 'Define at least 2 SLOs that reference existing SLIs' : undefined,
  });

  checks.push({
    name: 'Error budget configured',
    description: 'Error budget should be configured for reliability management',
    passed: config.metrics.errorBudget !== undefined && config.metrics.errorBudget.thresholdActions.length > 0,
    severity: 'medium',
  });

  checks.push({
    name: 'Dashboard required for deployment',
    description: 'Dashboards should be required before deployment',
    passed: config.metrics.dashboardRequired,
    severity: 'medium',
  });

  // Tracing checks
  checks.push({
    name: 'Distributed tracing enabled',
    description: 'Tracing should be enabled for debugging',
    passed: config.tracing.enabled,
    severity: 'high',
  });

  checks.push({
    name: 'Trace propagation configured',
    description: 'Trace propagation formats should be configured',
    passed: config.tracing.propagationFormats.length > 0,
    severity: 'medium',
  });

  // Alerting checks
  checks.push({
    name: 'Alert escalation policy configured',
    description: 'Escalation policies should be defined',
    passed: config.alerting.escalationPolicies.length > 0,
    severity: 'critical',
  });

  checks.push({
    name: 'Default notification channels configured',
    description: 'Default channels should be set for alerts',
    passed: config.alerting.defaultChannels.length > 0,
    severity: 'high',
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = passedCount / checks.length;

  return {
    category: 'observability',
    score,
    passed: score >= 0.7,
    checks,
  };
}

function checkReliabilityCompliance(config: ReliabilityConfig): ComplianceCategoryResult {
  const checks: ComplianceCheck[] = [];

  // Incident response checks
  checks.push({
    name: 'Severity levels defined',
    description: 'Incident severity levels should be defined',
    passed: config.incidentResponse.severityLevels.length >= 3,
    severity: 'critical',
  });

  checks.push({
    name: 'Escalation policy defined',
    description: 'Escalation policy should be configured',
    passed: config.incidentResponse.escalationPolicy.length > 0,
    severity: 'critical',
  });

  checks.push({
    name: 'Communication channels configured',
    description: 'Incident communication channels should be defined',
    passed: config.incidentResponse.communicationChannels.length > 0,
    severity: 'high',
  });

  checks.push({
    name: 'Runbooks required',
    description: 'Runbooks should be required for alerts',
    passed: config.incidentResponse.runbookRequired,
    severity: 'medium',
  });

  // Post-mortem checks
  checks.push({
    name: 'Blameless post-mortems',
    description: 'Post-mortems should be blameless',
    passed: config.postMortemTemplate.blameless,
    severity: 'high',
  });

  checks.push({
    name: 'Post-mortem sections defined',
    description: 'Essential post-mortem sections should be required',
    passed: config.postMortemTemplate.sections.length >= 4,
    severity: 'medium',
  });

  checks.push({
    name: 'Post-mortem review required',
    description: 'Post-mortems should require review',
    passed: config.postMortemTemplate.reviewRequired,
    severity: 'medium',
  });

  // Disaster recovery checks
  checks.push({
    name: 'RTO defined',
    description: 'Recovery Time Objective should be defined',
    passed: config.disasterRecovery.rtoMinutes > 0,
    severity: 'critical',
  });

  checks.push({
    name: 'RPO defined',
    description: 'Recovery Point Objective should be defined',
    passed: config.disasterRecovery.rpoMinutes > 0,
    severity: 'critical',
  });

  checks.push({
    name: 'DR testing scheduled',
    description: 'Disaster recovery tests should be scheduled',
    passed: config.disasterRecovery.testSchedule !== undefined,
    severity: 'high',
  });

  checks.push({
    name: 'Backup verification enabled',
    description: 'Backups should be verified regularly',
    passed: config.disasterRecovery.backupConfig.verification.enabled,
    severity: 'critical',
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = passedCount / checks.length;

  return {
    category: 'reliability',
    score,
    passed: score >= 0.7,
    checks,
  };
}

function checkDeploymentCompliance(config: DeploymentConfig): ComplianceCategoryResult {
  const checks: ComplianceCheck[] = [];

  // Pipeline checks
  checks.push({
    name: 'Quality gates defined',
    description: 'Quality gates should be configured in the pipeline',
    passed: config.pipeline.qualityGates.length >= 2,
    severity: 'high',
  });

  checks.push({
    name: 'Environment progression defined',
    description: 'Environment progression should be configured',
    passed: config.pipeline.environments.length >= 2,
    severity: 'high',
  });

  checks.push({
    name: 'Production approval required',
    description: 'Production deployments should require approval',
    passed: config.pipeline.approvals.some((a) => a.stage === 'production'),
    severity: 'critical',
  });

  // Strategy checks
  checks.push({
    name: 'Safe deployment strategy',
    description: 'Use canary or blue-green deployment',
    passed: config.strategy === 'canary' || config.strategy === 'blue_green',
    severity: 'high',
    details: config.strategy === 'recreate' ? 'Consider using canary or blue-green deployment for safer rollouts' : undefined,
  });

  // Rollback checks
  checks.push({
    name: 'Automatic rollback enabled',
    description: 'Automatic rollback should be enabled',
    passed: config.rollback.automatic,
    severity: 'critical',
  });

  checks.push({
    name: 'Rollback triggers defined',
    description: 'Rollback triggers should be configured',
    passed: config.rollback.triggers.length > 0,
    severity: 'high',
  });

  checks.push({
    name: 'Rollback time limit set',
    description: 'Maximum rollback time should be defined',
    passed: config.rollback.maxRollbackTime > 0 && config.rollback.maxRollbackTime <= 300,
    severity: 'medium',
  });

  // Feature flags checks
  checks.push({
    name: 'Feature flags configured',
    description: 'Feature flag system should be configured',
    passed: config.featureFlags.provider !== undefined,
    severity: 'medium',
  });

  checks.push({
    name: 'Stale flag policy defined',
    description: 'Policy for handling stale flags should be defined',
    passed: config.featureFlags.stalePolicy.enabled,
    severity: 'low',
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = passedCount / checks.length;

  return {
    category: 'deployment',
    score,
    passed: score >= 0.7,
    checks,
  };
}

function checkSecurityCompliance(config: SecOpsConfig): ComplianceCategoryResult {
  const checks: ComplianceCheck[] = [];

  // Vulnerability management checks
  checks.push({
    name: 'Vulnerability scanning enabled',
    description: 'Regular vulnerability scanning should be enabled',
    passed: config.vulnerabilityManagement.scanning.scanTypes.length >= 2,
    severity: 'critical',
  });

  checks.push({
    name: 'Remediation SLAs defined',
    description: 'SLAs for vulnerability remediation should be defined',
    passed: config.vulnerabilityManagement.remediationSLA !== undefined,
    severity: 'critical',
  });

  checks.push({
    name: 'Block on critical vulnerabilities',
    description: 'Deployments should be blocked on critical vulnerabilities',
    passed: config.vulnerabilityManagement.scanning.blockOnSeverity === 'critical' ||
            config.vulnerabilityManagement.scanning.blockOnSeverity === 'high',
    severity: 'critical',
  });

  // Secrets management checks
  checks.push({
    name: 'Secrets rotation enabled',
    description: 'Secret rotation should be enabled',
    passed: config.secretsManagement.rotationPolicy.enabled,
    severity: 'critical',
  });

  checks.push({
    name: 'Secret access auditing enabled',
    description: 'Secret access should be audited',
    passed: config.secretsManagement.audit.logAccess,
    severity: 'high',
  });

  // Access control checks
  checks.push({
    name: 'MFA required',
    description: 'Multi-factor authentication should be required',
    passed: config.accessControl.authentication.mfaPolicy.required,
    severity: 'critical',
  });

  checks.push({
    name: 'Session timeout configured',
    description: 'Session timeout should be configured',
    passed: config.accessControl.authentication.session.idleTimeoutMinutes <= 60,
    severity: 'high',
  });

  checks.push({
    name: 'Access review enabled',
    description: 'Regular access reviews should be enabled',
    passed: config.accessControl.accessReview.enabled,
    severity: 'high',
  });

  // Audit checks
  checks.push({
    name: 'Audit logging enabled',
    description: 'Comprehensive audit logging should be enabled',
    passed: config.auditLogging.auditedEvents.length >= 3,
    severity: 'critical',
  });

  checks.push({
    name: 'Tamper protection enabled',
    description: 'Audit logs should have tamper protection',
    passed: config.auditLogging.tamperProtection.enabled,
    severity: 'high',
  });

  checks.push({
    name: 'Audit retention configured',
    description: 'Audit log retention should be configured',
    passed: config.auditLogging.retention.deleteAfterDays >= 365,
    severity: 'medium',
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = passedCount / checks.length;

  return {
    category: 'security',
    score,
    passed: score >= 0.7,
    checks,
  };
}

// ============================================================================
// HEALTH SCORE CALCULATOR
// ============================================================================

/**
 * Calculates operational health score
 */
export function calculateHealthScore(config: OperationalExcellenceConfig): HealthScoreResult {
  const now = new Date().toISOString();
  const dimensions: HealthDimensionScore[] = [];

  // Calculate observability health
  dimensions.push(calculateObservabilityHealth(config.observability));

  // Calculate reliability health
  dimensions.push(calculateReliabilityHealth(config.reliability));

  // Calculate deployment health
  dimensions.push(calculateDeploymentHealth(config.deployment));

  // Calculate security health
  dimensions.push(calculateSecurityHealth(config.secOps));

  // Compute weighted overall score
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const overallScore = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight;

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (overallScore >= 0.9) {
    riskLevel = 'low';
  } else if (overallScore >= 0.7) {
    riskLevel = 'medium';
  } else if (overallScore >= 0.5) {
    riskLevel = 'high';
  } else {
    riskLevel = 'critical';
  }

  // Generate recommendations
  const recommendations = generateHealthRecommendations(dimensions);

  return {
    overallScore,
    confidence: {
      level: overallScore >= 0.8 ? 'established' : overallScore >= 0.5 ? 'probable' : 'speculative',
      score: overallScore,
      factors: dimensions.map((d) => ({
        name: d.dimension,
        contribution: d.weight,
        evidence: `Score: ${(d.score * 100).toFixed(1)}%`,
        quality: d.score >= 0.8 ? 'strong' : d.score >= 0.6 ? 'moderate' : 'weak' as const,
      })),
      lastAssessed: now,
      assessedBy: 'automated',
    },
    dimensions,
    trend: 'stable', // Would need historical data for actual trend
    riskLevel,
    recommendations,
    calculatedAt: now,
  };
}

function calculateObservabilityHealth(config: ObservabilityConfig): HealthDimensionScore {
  const factors: HealthFactor[] = [];

  // Logging factor
  const loggingScore =
    (config.logging.format === 'structured' ? 0.3 : 0) +
    (config.logging.requiredFields.length >= 3 ? 0.3 : config.logging.requiredFields.length * 0.1) +
    (config.logging.piiHandling !== undefined ? 0.4 : 0);
  factors.push({ name: 'Logging', score: loggingScore, evidence: `Format: ${config.logging.format}, Fields: ${config.logging.requiredFields.length}` });

  // Metrics factor
  const metricsScore =
    Math.min(config.metrics.slis.length / 4, 1) * 0.3 +
    Math.min(config.metrics.slos.length / 4, 1) * 0.3 +
    (config.metrics.errorBudget?.thresholdActions?.length > 0 ? 0.2 : 0) +
    (config.metrics.dashboardRequired ? 0.2 : 0);
  factors.push({ name: 'Metrics', score: metricsScore, evidence: `SLIs: ${config.metrics.slis.length}, SLOs: ${config.metrics.slos.length}` });

  // Tracing factor
  const tracingScore =
    (config.tracing.enabled ? 0.5 : 0) +
    (config.tracing.propagationFormats.length > 0 ? 0.3 : 0) +
    (config.tracing.samplingRate !== undefined ? 0.2 : 0);
  factors.push({ name: 'Tracing', score: tracingScore, evidence: `Enabled: ${config.tracing.enabled}` });

  // Alerting factor
  const alertingScore =
    (config.alerting.escalationPolicies.length > 0 ? 0.4 : 0) +
    (config.alerting.defaultChannels.length > 0 ? 0.3 : 0) +
    (config.alerting.onCallIntegration !== undefined ? 0.3 : 0);
  factors.push({ name: 'Alerting', score: alertingScore, evidence: `Policies: ${config.alerting.escalationPolicies.length}` });

  const score = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

  return {
    dimension: 'Observability',
    score,
    weight: 0.25,
    factors,
  };
}

function calculateReliabilityHealth(config: ReliabilityConfig): HealthDimensionScore {
  const factors: HealthFactor[] = [];

  // Incident response factor
  const irScore =
    (config.incidentResponse.severityLevels.length >= 3 ? 0.3 : config.incidentResponse.severityLevels.length * 0.1) +
    (config.incidentResponse.escalationPolicy.length > 0 ? 0.3 : 0) +
    (config.incidentResponse.runbookRequired ? 0.2 : 0) +
    (config.incidentResponse.communicationChannels.length > 0 ? 0.2 : 0);
  factors.push({ name: 'Incident Response', score: irScore, evidence: `Severity levels: ${config.incidentResponse.severityLevels.length}` });

  // Post-mortem factor
  const pmScore =
    (config.postMortemTemplate.blameless ? 0.4 : 0) +
    (config.postMortemTemplate.sections.length >= 4 ? 0.3 : config.postMortemTemplate.sections.length * 0.075) +
    (config.postMortemTemplate.reviewRequired ? 0.3 : 0);
  factors.push({ name: 'Post-Mortems', score: pmScore, evidence: `Blameless: ${config.postMortemTemplate.blameless}` });

  // DR factor
  const drScore =
    (config.disasterRecovery.rtoMinutes > 0 ? 0.25 : 0) +
    (config.disasterRecovery.rpoMinutes > 0 ? 0.25 : 0) +
    (config.disasterRecovery.backupConfig.verification.enabled ? 0.25 : 0) +
    (config.disasterRecovery.testSchedule !== undefined ? 0.25 : 0);
  factors.push({ name: 'Disaster Recovery', score: drScore, evidence: `RTO: ${config.disasterRecovery.rtoMinutes}min, RPO: ${config.disasterRecovery.rpoMinutes}min` });

  const score = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

  return {
    dimension: 'Reliability',
    score,
    weight: 0.25,
    factors,
  };
}

function calculateDeploymentHealth(config: DeploymentConfig): HealthDimensionScore {
  const factors: HealthFactor[] = [];

  // Pipeline factor
  const pipelineScore =
    (config.pipeline.qualityGates.length >= 2 ? 0.3 : config.pipeline.qualityGates.length * 0.15) +
    (config.pipeline.environments.length >= 2 ? 0.3 : 0) +
    (config.pipeline.approvals.length > 0 ? 0.4 : 0);
  factors.push({ name: 'Pipeline', score: pipelineScore, evidence: `Quality gates: ${config.pipeline.qualityGates.length}` });

  // Strategy factor
  const strategyScore =
    config.strategy === 'canary' ? 1.0 :
    config.strategy === 'blue_green' ? 0.9 :
    config.strategy === 'rolling' ? 0.7 :
    config.strategy === 'shadow' ? 0.8 : 0.3;
  factors.push({ name: 'Strategy', score: strategyScore, evidence: `Strategy: ${config.strategy}` });

  // Rollback factor
  const rollbackScore =
    (config.rollback.automatic ? 0.4 : 0) +
    (config.rollback.triggers.length > 0 ? 0.3 : 0) +
    (config.rollback.maxRollbackTime <= 300 ? 0.3 : 0.1);
  factors.push({ name: 'Rollback', score: rollbackScore, evidence: `Automatic: ${config.rollback.automatic}` });

  // Feature flags factor
  const ffScore =
    (config.featureFlags.provider !== undefined ? 0.5 : 0) +
    (config.featureFlags.stalePolicy.enabled ? 0.3 : 0) +
    (config.featureFlags.auditEnabled ? 0.2 : 0);
  factors.push({ name: 'Feature Flags', score: ffScore, evidence: `Provider: ${config.featureFlags.provider}` });

  const score = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

  return {
    dimension: 'Deployment',
    score,
    weight: 0.25,
    factors,
  };
}

function calculateSecurityHealth(config: SecOpsConfig): HealthDimensionScore {
  const factors: HealthFactor[] = [];

  // Vulnerability management factor
  const vulnScore =
    (config.vulnerabilityManagement.scanning.scanTypes.length >= 2 ? 0.3 : config.vulnerabilityManagement.scanning.scanTypes.length * 0.15) +
    (config.vulnerabilityManagement.scanning.blockOnSeverity === 'critical' || config.vulnerabilityManagement.scanning.blockOnSeverity === 'high' ? 0.4 : 0.1) +
    (config.vulnerabilityManagement.remediationSLA !== undefined ? 0.3 : 0);
  factors.push({ name: 'Vulnerability Management', score: vulnScore, evidence: `Scan types: ${config.vulnerabilityManagement.scanning.scanTypes.length}` });

  // Secrets management factor
  const secretsScore =
    (config.secretsManagement.rotationPolicy.enabled ? 0.4 : 0) +
    (config.secretsManagement.audit.logAccess ? 0.3 : 0) +
    (config.secretsManagement.accessPolicy.requireMFA ? 0.3 : 0);
  factors.push({ name: 'Secrets Management', score: secretsScore, evidence: `Rotation: ${config.secretsManagement.rotationPolicy.enabled}` });

  // Access control factor
  const accessScore =
    (config.accessControl.authentication.mfaPolicy.required ? 0.4 : 0) +
    (config.accessControl.authentication.session.idleTimeoutMinutes <= 60 ? 0.3 : 0.1) +
    (config.accessControl.accessReview.enabled ? 0.3 : 0);
  factors.push({ name: 'Access Control', score: accessScore, evidence: `MFA required: ${config.accessControl.authentication.mfaPolicy.required}` });

  // Audit factor
  const auditScore =
    (config.auditLogging.auditedEvents.length >= 3 ? 0.4 : config.auditLogging.auditedEvents.length * 0.13) +
    (config.auditLogging.tamperProtection.enabled ? 0.3 : 0) +
    (config.auditLogging.retention.deleteAfterDays >= 365 ? 0.3 : 0.1);
  factors.push({ name: 'Audit Logging', score: auditScore, evidence: `Events audited: ${config.auditLogging.auditedEvents.length}` });

  const score = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

  return {
    dimension: 'Security',
    score,
    weight: 0.25,
    factors,
  };
}

function generateHealthRecommendations(dimensions: HealthDimensionScore[]): HealthRecommendation[] {
  const recommendations: HealthRecommendation[] = [];

  for (const dim of dimensions) {
    for (const factor of dim.factors) {
      if (factor.score < 0.5) {
        recommendations.push({
          priority: 'high',
          category: dim.dimension,
          recommendation: `Improve ${factor.name} configuration`,
          impact: `Current score: ${(factor.score * 100).toFixed(0)}%`,
          effort: 'medium',
        });
      } else if (factor.score < 0.8) {
        recommendations.push({
          priority: 'medium',
          category: dim.dimension,
          recommendation: `Enhance ${factor.name} setup`,
          impact: `Current score: ${(factor.score * 100).toFixed(0)}%`,
          effort: 'low',
        });
      }
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations.slice(0, 10); // Top 10 recommendations
}

// ============================================================================
// RUNBOOK GENERATOR
// ============================================================================

/**
 * Generates a runbook template based on type and context
 */
export function generateRunbookTemplate(
  type: RunbookTemplate['type'],
  context: {
    serviceName: string;
    severity?: string;
    alertName?: string;
    description?: string;
  }
): RunbookTemplate {
  const now = new Date().toISOString();
  // Use both timestamp and random suffix for uniqueness
  const id = `runbook-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const baseSections: RunbookSection[] = [
    {
      title: 'Overview',
      type: 'overview',
      content: context.description || `Runbook for ${type} scenario affecting ${context.serviceName}`,
    },
    {
      title: 'Prerequisites',
      type: 'prerequisites',
      content: 'Ensure you have the necessary access and tools before proceeding.',
      steps: [
        { order: 1, description: 'Verify access to monitoring dashboards', automatable: false },
        { order: 2, description: 'Ensure CLI tools are available and authenticated', automatable: true },
        { order: 3, description: 'Confirm communication channels are accessible', automatable: false },
      ],
    },
  ];

  let specificSections: RunbookSection[] = [];

  switch (type) {
    case 'incident':
      specificSections = generateIncidentSections(context);
      break;
    case 'deployment':
      specificSections = generateDeploymentSections(context);
      break;
    case 'maintenance':
      specificSections = generateMaintenanceSections(context);
      break;
    case 'recovery':
      specificSections = generateRecoverySections(context);
      break;
    case 'investigation':
      specificSections = generateInvestigationSections(context);
      break;
  }

  return {
    id,
    title: `${type.charAt(0).toUpperCase() + type.slice(1)} Runbook: ${context.serviceName}`,
    description: context.description || `Standard operating procedure for ${type} scenarios`,
    type,
    severity: context.severity,
    tags: [type, context.serviceName, context.severity || 'general'].filter(Boolean),
    sections: [...baseSections, ...specificSections],
    metadata: {
      version: '1.0.0',
      author: 'system',
      createdAt: now,
      updatedAt: now,
      relatedServices: [context.serviceName],
      relatedAlerts: context.alertName ? [context.alertName] : undefined,
    },
  };
}

function generateIncidentSections(context: { serviceName: string }): RunbookSection[] {
  return [
    {
      title: 'Initial Assessment',
      type: 'steps',
      content: 'Quickly assess the scope and impact of the incident.',
      steps: [
        { order: 1, description: 'Check monitoring dashboards for affected metrics', automatable: false },
        { order: 2, description: `Verify ${context.serviceName} health status`, command: `kubectl get pods -l app=${context.serviceName}`, automatable: true },
        { order: 3, description: 'Review recent deployments or changes', automatable: false },
        { order: 4, description: 'Identify affected customers/users', automatable: false },
      ],
    },
    {
      title: 'Mitigation Steps',
      type: 'steps',
      content: 'Take immediate action to reduce impact.',
      steps: [
        { order: 1, description: 'Enable circuit breaker if available', automatable: true },
        { order: 2, description: 'Scale up resources if under load', command: `kubectl scale deployment ${context.serviceName} --replicas=5`, automatable: true },
        { order: 3, description: 'Failover to backup region if necessary', automatable: false },
      ],
    },
    {
      title: 'Verification',
      type: 'verification',
      content: 'Confirm the incident is resolved.',
      steps: [
        { order: 1, description: 'Verify metrics have returned to normal', automatable: false },
        { order: 2, description: 'Confirm no new errors in logs', automatable: true },
        { order: 3, description: 'Test critical user flows', automatable: false },
      ],
    },
    {
      title: 'Rollback Procedures',
      type: 'rollback',
      content: 'If mitigation fails, follow these rollback steps.',
      steps: [
        { order: 1, description: 'Identify the last known good version', automatable: false },
        { order: 2, description: 'Execute rollback', command: `kubectl rollout undo deployment/${context.serviceName}`, automatable: true },
        { order: 3, description: 'Verify rollback succeeded', automatable: true },
      ],
    },
    {
      title: 'Escalation',
      type: 'escalation',
      content: 'Escalation path if resolution is not achievable.',
      steps: [
        { order: 1, description: 'Notify engineering manager', automatable: false },
        { order: 2, description: 'Engage subject matter experts', automatable: false },
        { order: 3, description: 'Update status page', automatable: true },
      ],
    },
  ];
}

function generateDeploymentSections(context: { serviceName: string }): RunbookSection[] {
  return [
    {
      title: 'Pre-Deployment Checks',
      type: 'steps',
      content: 'Verify readiness before deployment.',
      steps: [
        { order: 1, description: 'Confirm all tests have passed', automatable: true },
        { order: 2, description: 'Verify deployment window is approved', automatable: false },
        { order: 3, description: 'Ensure rollback plan is ready', automatable: false },
        { order: 4, description: 'Notify stakeholders of pending deployment', automatable: true },
      ],
    },
    {
      title: 'Deployment Steps',
      type: 'steps',
      content: 'Execute the deployment.',
      steps: [
        { order: 1, description: 'Deploy to staging environment', command: `kubectl apply -f staging/`, automatable: true },
        { order: 2, description: 'Run smoke tests on staging', automatable: true },
        { order: 3, description: 'Promote to production', command: `kubectl apply -f production/`, automatable: true },
        { order: 4, description: 'Monitor canary metrics', automatable: false },
      ],
    },
    {
      title: 'Post-Deployment Verification',
      type: 'verification',
      content: 'Confirm deployment success.',
      steps: [
        { order: 1, description: 'Verify all pods are healthy', command: `kubectl get pods -l app=${context.serviceName}`, automatable: true },
        { order: 2, description: 'Check error rates are within SLO', automatable: true },
        { order: 3, description: 'Validate key user flows', automatable: false },
      ],
    },
    {
      title: 'Rollback Procedures',
      type: 'rollback',
      content: 'Rollback if issues are detected.',
      steps: [
        { order: 1, description: 'Execute rollback', command: `kubectl rollout undo deployment/${context.serviceName}`, rollbackCommand: 'N/A', automatable: true },
        { order: 2, description: 'Verify previous version is running', automatable: true },
        { order: 3, description: 'Document reason for rollback', automatable: false },
      ],
    },
  ];
}

function generateMaintenanceSections(context: { serviceName: string }): RunbookSection[] {
  return [
    {
      title: 'Pre-Maintenance',
      type: 'steps',
      content: 'Prepare for maintenance window.',
      steps: [
        { order: 1, description: 'Schedule maintenance window', automatable: false },
        { order: 2, description: 'Notify affected users', automatable: true },
        { order: 3, description: 'Update status page', automatable: true },
        { order: 4, description: 'Create backup if necessary', automatable: true },
      ],
    },
    {
      title: 'Maintenance Procedures',
      type: 'steps',
      content: 'Execute maintenance tasks.',
      steps: [
        { order: 1, description: 'Drain traffic from target nodes', command: `kubectl drain node/<node-name>`, automatable: true },
        { order: 2, description: 'Perform maintenance tasks', automatable: false },
        { order: 3, description: 'Verify maintenance completed successfully', automatable: false },
      ],
    },
    {
      title: 'Post-Maintenance',
      type: 'verification',
      content: 'Restore normal operations.',
      steps: [
        { order: 1, description: 'Restore traffic to nodes', command: `kubectl uncordon node/<node-name>`, automatable: true },
        { order: 2, description: 'Verify service health', automatable: true },
        { order: 3, description: 'Update status page to operational', automatable: true },
      ],
    },
  ];
}

function generateRecoverySections(context: { serviceName: string }): RunbookSection[] {
  return [
    {
      title: 'Assess Damage',
      type: 'steps',
      content: 'Understand the scope of recovery needed.',
      steps: [
        { order: 1, description: 'Identify affected components', automatable: false },
        { order: 2, description: 'Determine data loss if any', automatable: false },
        { order: 3, description: 'Assess infrastructure status', automatable: true },
      ],
    },
    {
      title: 'Recovery Procedures',
      type: 'steps',
      content: 'Execute recovery steps.',
      steps: [
        { order: 1, description: 'Restore from latest backup', command: `./scripts/restore-backup.sh`, automatable: true },
        { order: 2, description: 'Recreate failed infrastructure', automatable: true },
        { order: 3, description: 'Redeploy applications', command: `kubectl apply -f production/`, automatable: true },
        { order: 4, description: 'Restore DNS and networking', automatable: false },
      ],
    },
    {
      title: 'Verification',
      type: 'verification',
      content: 'Confirm recovery success.',
      steps: [
        { order: 1, description: 'Verify data integrity', automatable: true },
        { order: 2, description: 'Test all critical paths', automatable: false },
        { order: 3, description: 'Confirm monitoring is operational', automatable: true },
      ],
    },
  ];
}

function generateInvestigationSections(context: { serviceName: string }): RunbookSection[] {
  return [
    {
      title: 'Gather Information',
      type: 'steps',
      content: 'Collect relevant data for investigation.',
      steps: [
        { order: 1, description: 'Pull recent logs', command: `kubectl logs -l app=${context.serviceName} --since=1h`, automatable: true },
        { order: 2, description: 'Export metrics for timeframe', automatable: true },
        { order: 3, description: 'Collect trace data', automatable: true },
        { order: 4, description: 'Document timeline of events', automatable: false },
      ],
    },
    {
      title: 'Analysis',
      type: 'steps',
      content: 'Analyze collected data.',
      steps: [
        { order: 1, description: 'Correlate events across services', automatable: false },
        { order: 2, description: 'Identify root cause candidates', automatable: false },
        { order: 3, description: 'Test hypotheses', automatable: false },
      ],
    },
    {
      title: 'Documentation',
      type: 'notes',
      content: 'Document findings and recommendations.',
    },
  ];
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
    return Object.freeze(value);
  }
  const record = value as Record<string, unknown>;
  Object.values(record).forEach((entry) => deepFreeze(entry));
  return Object.freeze(value);
}

/**
 * Enterprise-grade operational excellence configuration
 * Suitable for large organizations with strict compliance requirements
 */
export const ENTERPRISE_CONFIG: OperationalExcellenceConfig = deepFreeze({
  observability: {
    logging: {
      format: 'structured',
      levels: ['debug', 'info', 'warn', 'error'],
      retentionDays: 90,
      requiredFields: ['correlationId', 'timestamp', 'service', 'traceId', 'spanId', 'userId'],
      piiHandling: 'redact',
      maxMessageSize: 65536,
      samplingRate: 1.0,
    },
    metrics: {
      slis: [
        { name: 'availability', type: 'availability', measurement: '(1 - error_rate) * 100' },
        { name: 'latency_p99', type: 'latency', measurement: 'histogram_quantile(0.99, http_request_duration_seconds)', unit: 'seconds' },
        { name: 'throughput', type: 'throughput', measurement: 'rate(http_requests_total[5m])', unit: 'requests/second' },
        { name: 'error_rate', type: 'error_rate', measurement: 'rate(http_errors_total[5m]) / rate(http_requests_total[5m]) * 100' },
      ],
      slos: [
        { sliName: 'availability', target: 99.95, window: 'rolling_30d' },
        { sliName: 'latency_p99', target: 0.5, window: 'rolling_7d' },
        { sliName: 'error_rate', target: 0.1, window: 'rolling_7d' },
      ],
      errorBudget: {
        calculation: 'one_minus_slo',
        thresholdActions: [
          { thresholdPercent: 50, actions: [{ type: 'notify', channels: ['#engineering'] }] },
          { thresholdPercent: 25, actions: [{ type: 'reduce_change_velocity', factor: 0.5 }] },
          { thresholdPercent: 10, actions: [{ type: 'freeze_deployments' }] },
        ],
        resetSchedule: 'monthly',
        trackVelocity: true,
      },
      dashboardRequired: true,
    },
    tracing: {
      enabled: true,
      samplingStrategy: 'probabilistic',
      samplingRate: 0.1,
      propagationFormats: ['w3c', 'b3'],
      exporter: { type: 'otlp', endpoint: 'https://otel-collector:4317' },
      requiredAttributes: ['service.name', 'service.version', 'deployment.environment'],
      maxSpansPerTrace: 1000,
    },
    alerting: {
      routes: [
        { match: { severity: 'critical' }, channels: ['pagerduty'], continue: false },
        { match: { severity: 'high' }, channels: ['slack-oncall'], continue: true },
        { match: {} as Record<string, string>, channels: ['slack-alerts'], continue: false },
      ],
      defaultChannels: ['slack-alerts'],
      escalationPolicies: [
        {
          name: 'default',
          steps: [
            { order: 1, delayMinutes: 5, targets: [{ type: 'schedule', id: 'primary-oncall', method: 'pagerduty' }] },
            { order: 2, delayMinutes: 15, targets: [{ type: 'schedule', id: 'secondary-oncall', method: 'pagerduty' }] },
            { order: 3, delayMinutes: 30, targets: [{ type: 'team', id: 'engineering-managers', method: 'email' }] },
          ],
          repeatEnabled: true,
          repeatIntervalMinutes: 30,
        },
      ],
      deduplication: { keyFields: ['alertname', 'service'], windowMinutes: 60, trackCount: true },
    },
  },
  reliability: {
    incidentResponse: {
      severityLevels: [
        { id: 'sev1', name: 'Critical', description: 'Complete service outage', responseTimeMinutes: 5, resolutionTargetMinutes: 60, pagesOnCall: true, requiredResponders: ['incident-commander', 'engineering-lead'] },
        { id: 'sev2', name: 'Major', description: 'Significant degradation', responseTimeMinutes: 15, resolutionTargetMinutes: 120, pagesOnCall: true },
        { id: 'sev3', name: 'Minor', description: 'Limited impact', responseTimeMinutes: 60, resolutionTargetMinutes: 480, pagesOnCall: false },
        { id: 'sev4', name: 'Low', description: 'Minimal impact', responseTimeMinutes: 240, resolutionTargetMinutes: 2880, pagesOnCall: false },
      ],
      escalationPolicy: [
        { order: 1, delayMinutes: 5, targets: [{ type: 'schedule', id: 'primary-oncall', method: 'pagerduty' }] },
        { order: 2, delayMinutes: 15, targets: [{ type: 'user', id: 'engineering-manager', method: 'sms' }] },
      ],
      communicationChannels: ['#incident-room', '#engineering', 'status-page'],
      runbookRequired: true,
      statusPage: { provider: 'statuspage', autoUpdate: true, components: [] },
    },
    postMortemTemplate: {
      sections: ['timeline', 'impact', 'root_cause', 'contributing_factors', 'action_items', 'lessons_learned', 'detection', 'response', 'prevention'],
      blameless: true,
      reviewRequired: true,
      publishInternal: true,
      publishDeadlineHours: 72,
    },
    capacityPlanning: {
      capacityMetrics: [
        { name: 'cpu_utilization', resource: 'cpu', currentValue: 0, unit: 'percent', maxValue: 100, projectionModel: 'linear' },
        { name: 'memory_utilization', resource: 'memory', currentValue: 0, unit: 'percent', maxValue: 100, projectionModel: 'linear' },
      ],
      planningHorizonDays: 90,
      bufferPercent: 30,
      scalingThresholds: [
        { metric: 'cpu_utilization', warnThreshold: 70, criticalThreshold: 85, cooldownMinutes: 10 },
        { metric: 'memory_utilization', warnThreshold: 75, criticalThreshold: 90, cooldownMinutes: 10 },
      ],
      reviewCadence: 'monthly',
      costTrackingEnabled: true,
    },
    disasterRecovery: {
      rtoMinutes: 60,
      rpoMinutes: 15,
      backupConfig: {
        frequency: 'continuous',
        retention: { dailyBackups: 7, weeklyBackups: 4, monthlyBackups: 12, yearlyBackups: 7 },
        destinations: [
          { type: 's3', location: 's3://backups-primary', tier: 'hot' },
          { type: 's3', location: 's3://backups-dr', tier: 'warm' },
        ],
        encryption: { enabled: true, algorithm: 'aes-256-gcm', keyManagement: 'kms' },
        verification: { enabled: true, frequency: 'daily', verifyIntegrity: true, testRestore: true },
      },
      failoverConfig: {
        mode: 'active_passive',
        automaticFailover: true,
        triggers: [{ condition: 'health_check_failure', consecutiveFailures: 3 }],
        healthCheck: { endpoint: '/health', intervalSeconds: 10, timeoutSeconds: 5, healthyThreshold: 2, unhealthyThreshold: 3 },
      },
      testSchedule: { frequency: 'quarterly', type: 'simulation', requiredParticipants: ['sre-team', 'engineering-leads'] },
    },
  },
  deployment: {
    pipeline: {
      stages: [
        { name: 'build', type: 'build', required: true, timeout: 600, retries: 1 },
        { name: 'test', type: 'test', required: true, timeout: 1200, retries: 1, dependsOn: ['build'] },
        { name: 'security-scan', type: 'security', required: true, timeout: 900, retries: 0, dependsOn: ['build'] },
        { name: 'deploy-staging', type: 'deploy', required: true, timeout: 600, retries: 1, dependsOn: ['test', 'security-scan'] },
        { name: 'integration-test', type: 'verify', required: true, timeout: 1800, retries: 1, dependsOn: ['deploy-staging'] },
        { name: 'deploy-production', type: 'deploy', required: true, timeout: 1200, retries: 0, dependsOn: ['integration-test'] },
      ],
      qualityGates: [
        { name: 'test-coverage', type: 'test_coverage', threshold: 80, blocking: true, allowOverride: false },
        { name: 'security-scan', type: 'security_scan', blocking: true, allowOverride: false },
        { name: 'lint', type: 'lint', blocking: true, allowOverride: true, overrideApprovers: ['tech-leads'] },
        { name: 'manual-review', type: 'manual', blocking: true, allowOverride: false },
      ],
      environments: [
        { name: 'development', type: 'development', autoPromote: true },
        { name: 'staging', type: 'staging', autoPromote: false, promotionGates: ['integration-test'] },
        { name: 'production', type: 'production', autoPromote: false, promotionGates: ['manual-review'], protectedBranches: ['main'] },
      ],
      approvals: [
        { stage: 'production', requiredApprovers: 2, approverGroups: ['tech-leads', 'engineering-managers'], timeoutHours: 24 },
      ],
      artifacts: { registry: 'gcr.io/project/repo', retention: { production: 90, staging: 30, development: 7 }, signing: true, scanEnabled: true },
    },
    strategy: 'canary',
    featureFlags: {
      provider: 'launchdarkly',
      defaultState: 'off',
      targetingRules: [],
      stalePolicy: { enabled: true, staleAfterDays: 30, action: 'notify', notifyChannels: ['#engineering'] },
      auditEnabled: true,
      lifecycle: { requireDescription: true, requireOwner: true, requireExpiryDate: true, maxLifetimeDays: 90 },
    },
    rollback: {
      automatic: true,
      triggers: [
        { type: 'error_rate', threshold: 5, evaluationWindowSeconds: 300 },
        { type: 'latency', threshold: 2000, evaluationWindowSeconds: 300 },
        { type: 'slo_breach' },
      ],
      maxRollbackTime: 120,
      dataRollbackStrategy: 'compensate',
      versionRetention: 10,
      notifyChannels: ['#deployments', '#oncall'],
      verification: { enabled: true, healthCheckEndpoint: '/health', successCriteria: [{ metric: 'error_rate', operator: 'lt', value: 1 }], timeoutSeconds: 300 },
    },
  },
  secOps: {
    vulnerabilityManagement: {
      scanning: {
        frequency: 'continuous',
        scanTypes: ['dependency', 'container', 'sast', 'dast', 'secrets'],
        blockOnSeverity: 'high',
        scanners: [
          { name: 'snyk', type: 'dependency', enabled: true, config: {} },
          { name: 'trivy', type: 'container', enabled: true, config: {} },
          { name: 'semgrep', type: 'sast', enabled: true, config: {} },
        ],
      },
      remediationSLA: {
        critical: { hours: 24, escalateAfterHours: 12 },
        high: { hours: 72, escalateAfterHours: 48 },
        medium: { hours: 168, escalateAfterHours: 120 },
        low: { hours: 720, escalateAfterHours: 480 },
      },
      exceptionPolicy: { allowExceptions: true, maxExceptionDays: 30, requiredApprovers: 2, requireJustification: true, reviewCadence: 'weekly' },
    },
    secretsManagement: {
      provider: 'vault',
      rotationPolicy: { enabled: true, defaultIntervalDays: 90, gracePeriodHours: 24, notifyBeforeDays: 14 },
      categories: [
        { name: 'api-keys', pattern: '^api[-_]?key', rotationIntervalDays: 30, accessLevel: 'service', encryptionRequired: true },
        { name: 'database', pattern: '^db[-_]', rotationIntervalDays: 90, accessLevel: 'restricted', encryptionRequired: true },
      ],
      accessPolicy: { requireMFA: true, maxAccessDuration: 3600, justInTimeAccess: true, approvalRequired: false, allowedServices: [] },
      audit: { logAccess: true, logRotation: true, alertOnAnomalousAccess: true, retentionDays: 365 },
    },
    accessControl: {
      authentication: {
        methods: [{ type: 'sso', enabled: true, provider: 'okta', config: {} }],
        mfaPolicy: { required: true, methods: ['totp', 'webauthn'], rememberDeviceDays: 7 },
        session: { maxDurationHours: 12, idleTimeoutMinutes: 30, concurrentSessions: 3, requireReauthForSensitive: true },
      },
      authorization: {
        model: 'rbac',
        roles: [
          { name: 'viewer', description: 'Read-only access', permissions: ['read'] },
          { name: 'operator', description: 'Operational access', permissions: ['read', 'execute'], inherits: ['viewer'] },
          { name: 'admin', description: 'Full access', permissions: ['read', 'create', 'update', 'delete', 'execute', 'admin'], inherits: ['operator'] },
        ],
        permissions: [
          { name: 'read', resource: '*', actions: ['read'] },
          { name: 'execute', resource: 'deployments', actions: ['execute'] },
        ],
        enforcement: 'both',
      },
      accessReview: { enabled: true, frequency: 'quarterly', reviewers: ['security-team', 'engineering-managers'], autoRevoke: false, reminderDays: [14, 7, 1] },
    },
    auditLogging: {
      auditedEvents: [
        { category: 'authentication', events: ['login', 'logout', 'mfa_challenge', 'password_change'], includePayload: false },
        { category: 'authorization', events: ['access_granted', 'access_denied', 'permission_change'], includePayload: true, sensitiveFields: ['password', 'token'] },
        { category: 'data_access', events: ['read', 'write', 'delete', 'export'], includePayload: true, sensitiveFields: ['ssn', 'credit_card'] },
        { category: 'configuration', events: ['config_change', 'secret_access', 'role_assignment'], includePayload: true },
      ],
      destination: { type: 'elasticsearch', config: { index: 'audit-logs' } },
      retention: { hotStorageDays: 30, warmStorageDays: 90, coldStorageDays: 365, deleteAfterDays: 2555 },
      tamperProtection: { enabled: true, method: 'hash_chain', verificationFrequency: 'daily' },
      alertRules: [
        { name: 'multiple-failed-logins', condition: { eventType: 'login_failed', count: 5, windowMinutes: 15 }, severity: 'warning', channels: ['#security'] },
        { name: 'admin-role-granted', condition: { eventType: 'role_assignment', pattern: 'admin' }, severity: 'info', channels: ['#security'] },
      ],
    },
  },
  metadata: {
    version: '1.0.0',
    name: 'Enterprise Configuration',
    description: 'Enterprise-grade operational excellence configuration for large organizations',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: 'platform-team',
    tags: ['enterprise', 'production', 'compliant'],
  },
});

/**
 * Startup-friendly operational excellence configuration
 * Balanced approach for growing organizations
 */
export const STARTUP_CONFIG: OperationalExcellenceConfig = deepFreeze({
  observability: {
    logging: {
      format: 'structured',
      levels: ['info', 'warn', 'error'],
      retentionDays: 30,
      requiredFields: ['correlationId', 'timestamp', 'service'],
      piiHandling: 'hash',
    },
    metrics: {
      slis: [
        { name: 'availability', type: 'availability', measurement: '(1 - error_rate) * 100' },
        { name: 'latency_p95', type: 'latency', measurement: 'histogram_quantile(0.95, http_request_duration_seconds)', unit: 'seconds' },
      ],
      slos: [
        { sliName: 'availability', target: 99.5, window: 'rolling_30d' },
        { sliName: 'latency_p95', target: 1.0, window: 'rolling_7d' },
      ],
      errorBudget: {
        calculation: 'one_minus_slo',
        thresholdActions: [
          { thresholdPercent: 25, actions: [{ type: 'notify', channels: ['#engineering'] }] },
        ],
        resetSchedule: 'monthly',
        trackVelocity: false,
      },
      dashboardRequired: true,
    },
    tracing: {
      enabled: true,
      samplingStrategy: 'probabilistic',
      samplingRate: 0.01,
      propagationFormats: ['w3c'],
      exporter: { type: 'jaeger', endpoint: 'http://jaeger:14268' },
    },
    alerting: {
      routes: [
        { match: { severity: 'critical' }, channels: ['slack-oncall'], continue: false },
        { match: {} as Record<string, string>, channels: ['slack-alerts'], continue: false },
      ],
      defaultChannels: ['slack-alerts'],
      escalationPolicies: [
        {
          name: 'default',
          steps: [
            { order: 1, delayMinutes: 10, targets: [{ type: 'channel', id: 'slack-oncall', method: 'slack' }] },
          ],
          repeatEnabled: false,
        },
      ],
    },
  },
  reliability: {
    incidentResponse: {
      severityLevels: [
        { id: 'sev1', name: 'Critical', description: 'Service outage', responseTimeMinutes: 15, resolutionTargetMinutes: 120, pagesOnCall: true },
        { id: 'sev2', name: 'Major', description: 'Degradation', responseTimeMinutes: 30, resolutionTargetMinutes: 240, pagesOnCall: true },
        { id: 'sev3', name: 'Minor', description: 'Limited impact', responseTimeMinutes: 120, resolutionTargetMinutes: 480, pagesOnCall: false },
      ],
      escalationPolicy: [
        { order: 1, delayMinutes: 15, targets: [{ type: 'channel', id: 'slack-oncall', method: 'slack' }] },
      ],
      communicationChannels: ['#incidents'],
      runbookRequired: false,
    },
    postMortemTemplate: {
      sections: ['timeline', 'impact', 'root_cause', 'action_items', 'lessons_learned'],
      blameless: true,
      reviewRequired: false,
      publishInternal: true,
    },
    capacityPlanning: {
      capacityMetrics: [
        { name: 'cpu_utilization', resource: 'cpu', currentValue: 0, unit: 'percent', maxValue: 100 },
      ],
      planningHorizonDays: 30,
      bufferPercent: 20,
      scalingThresholds: [
        { metric: 'cpu_utilization', warnThreshold: 75, criticalThreshold: 90, cooldownMinutes: 5 },
      ],
      reviewCadence: 'monthly',
      costTrackingEnabled: false,
    },
    disasterRecovery: {
      rtoMinutes: 240,
      rpoMinutes: 60,
      backupConfig: {
        frequency: 'daily',
        retention: { dailyBackups: 7, weeklyBackups: 4, monthlyBackups: 3 },
        destinations: [{ type: 's3', location: 's3://backups', tier: 'warm' }],
        encryption: { enabled: true, algorithm: 'aes-256-gcm', keyManagement: 'kms' },
        verification: { enabled: true, frequency: 'weekly', verifyIntegrity: true, testRestore: false },
      },
      failoverConfig: {
        mode: 'active_passive',
        automaticFailover: false,
        triggers: [{ condition: 'manual' }],
        healthCheck: { endpoint: '/health', intervalSeconds: 30, timeoutSeconds: 10, healthyThreshold: 2, unhealthyThreshold: 3 },
      },
      testSchedule: { frequency: 'biannually', type: 'tabletop', requiredParticipants: ['engineering-lead'] },
    },
  },
  deployment: {
    pipeline: {
      stages: [
        { name: 'build', type: 'build', required: true, timeout: 600, retries: 1 },
        { name: 'test', type: 'test', required: true, timeout: 900, retries: 1, dependsOn: ['build'] },
        { name: 'deploy', type: 'deploy', required: true, timeout: 600, retries: 1, dependsOn: ['test'] },
      ],
      qualityGates: [
        { name: 'test-coverage', type: 'test_coverage', threshold: 60, blocking: true, allowOverride: true },
        { name: 'lint', type: 'lint', blocking: false, allowOverride: true },
      ],
      environments: [
        { name: 'staging', type: 'staging', autoPromote: true },
        { name: 'production', type: 'production', autoPromote: false },
      ],
      approvals: [],
      artifacts: { registry: 'docker.io/org', retention: { production: 30, staging: 14, development: 7 }, signing: false, scanEnabled: true },
    },
    strategy: 'rolling',
    featureFlags: {
      provider: 'unleash',
      defaultState: 'off',
      targetingRules: [],
      stalePolicy: { enabled: true, staleAfterDays: 60, action: 'notify' },
      auditEnabled: false,
      lifecycle: { requireDescription: true, requireOwner: true, requireExpiryDate: false },
    },
    rollback: {
      automatic: true,
      triggers: [
        { type: 'error_rate', threshold: 10, evaluationWindowSeconds: 180 },
        { type: 'health_check', consecutiveFailures: 3 },
      ],
      maxRollbackTime: 300,
      dataRollbackStrategy: 'none',
      versionRetention: 5,
    },
  },
  secOps: {
    vulnerabilityManagement: {
      scanning: {
        frequency: 'daily',
        scanTypes: ['dependency', 'container'],
        blockOnSeverity: 'critical',
        scanners: [{ name: 'snyk', type: 'dependency', enabled: true, config: {} }],
      },
      remediationSLA: {
        critical: { hours: 72, escalateAfterHours: 48 },
        high: { hours: 168, escalateAfterHours: 120 },
        medium: { hours: 336, escalateAfterHours: 240 },
        low: { hours: 720, escalateAfterHours: 480 },
      },
      exceptionPolicy: { allowExceptions: true, maxExceptionDays: 60, requiredApprovers: 1, requireJustification: true, reviewCadence: 'monthly' },
    },
    secretsManagement: {
      provider: 'aws_secrets_manager',
      rotationPolicy: { enabled: true, defaultIntervalDays: 180, gracePeriodHours: 48, notifyBeforeDays: 7 },
      categories: [],
      accessPolicy: { requireMFA: false, maxAccessDuration: 7200, justInTimeAccess: false, approvalRequired: false, allowedServices: [] },
      audit: { logAccess: true, logRotation: true, alertOnAnomalousAccess: false, retentionDays: 90 },
    },
    accessControl: {
      authentication: {
        methods: [{ type: 'oidc', enabled: true, provider: 'google', config: {} }],
        mfaPolicy: { required: true, methods: ['totp'] },
        session: { maxDurationHours: 24, idleTimeoutMinutes: 60, concurrentSessions: 'unlimited', requireReauthForSensitive: false },
      },
      authorization: {
        model: 'rbac',
        roles: [
          { name: 'developer', description: 'Developer access', permissions: ['read', 'deploy-staging'] },
          { name: 'admin', description: 'Admin access', permissions: ['read', 'create', 'update', 'delete', 'execute', 'admin'] },
        ],
        permissions: [],
        enforcement: 'gateway',
      },
      accessReview: { enabled: false, frequency: 'annually', reviewers: [], autoRevoke: false, reminderDays: [7] },
    },
    auditLogging: {
      auditedEvents: [
        { category: 'authentication', events: ['login', 'logout'], includePayload: false },
        { category: 'authorization', events: ['access_denied'], includePayload: false },
        { category: 'configuration', events: ['config_change'], includePayload: true },
      ],
      destination: { type: 'cloudwatch', config: { logGroup: '/audit' } },
      retention: { hotStorageDays: 30, warmStorageDays: 60, coldStorageDays: 180, deleteAfterDays: 365 },
      tamperProtection: { enabled: false, method: 'hash_chain', verificationFrequency: 'weekly' },
      alertRules: [],
    },
  },
  metadata: {
    version: '1.0.0',
    name: 'Startup Configuration',
    description: 'Balanced operational excellence configuration for growing organizations',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: 'engineering-team',
    tags: ['startup', 'balanced', 'growth'],
  },
});

/**
 * Minimal operational excellence configuration
 * Basic setup for early-stage projects or development environments
 */
export const MINIMAL_CONFIG: OperationalExcellenceConfig = deepFreeze({
  observability: {
    logging: {
      format: 'text',
      levels: ['info', 'warn', 'error'],
      retentionDays: 7,
      requiredFields: ['timestamp'],
      piiHandling: 'exclude',
    },
    metrics: {
      slis: [
        { name: 'availability', type: 'availability', measurement: 'up == 1' },
      ],
      slos: [
        { sliName: 'availability', target: 99.0, window: 'rolling_7d' },
      ],
      errorBudget: {
        calculation: 'one_minus_slo',
        thresholdActions: [],
        resetSchedule: 'monthly',
        trackVelocity: false,
      },
      dashboardRequired: false,
    },
    tracing: {
      enabled: false,
      samplingStrategy: 'never',
      propagationFormats: [],
      exporter: { type: 'console' },
    },
    alerting: {
      routes: [],
      defaultChannels: ['email'],
      escalationPolicies: [],
    },
  },
  reliability: {
    incidentResponse: {
      severityLevels: [
        { id: 'sev1', name: 'Critical', description: 'Outage', responseTimeMinutes: 60, resolutionTargetMinutes: 480, pagesOnCall: false },
        { id: 'sev2', name: 'Minor', description: 'Issues', responseTimeMinutes: 240, resolutionTargetMinutes: 1440, pagesOnCall: false },
      ],
      escalationPolicy: [],
      communicationChannels: ['email'],
      runbookRequired: false,
    },
    postMortemTemplate: {
      sections: ['timeline', 'root_cause', 'action_items'],
      blameless: true,
      reviewRequired: false,
      publishInternal: false,
    },
    capacityPlanning: {
      capacityMetrics: [],
      planningHorizonDays: 14,
      bufferPercent: 10,
      scalingThresholds: [],
      reviewCadence: 'quarterly',
      costTrackingEnabled: false,
    },
    disasterRecovery: {
      rtoMinutes: 1440,
      rpoMinutes: 1440,
      backupConfig: {
        frequency: 'weekly',
        retention: { dailyBackups: 0, weeklyBackups: 2, monthlyBackups: 1 },
        destinations: [{ type: 'local', location: '/backups', tier: 'cold' }],
        encryption: { enabled: false, algorithm: 'aes-256-gcm', keyManagement: 'local' },
        verification: { enabled: false, frequency: 'monthly', verifyIntegrity: false, testRestore: false },
      },
      failoverConfig: {
        mode: 'active_passive',
        automaticFailover: false,
        triggers: [{ condition: 'manual' }],
        healthCheck: { endpoint: '/health', intervalSeconds: 60, timeoutSeconds: 30, healthyThreshold: 1, unhealthyThreshold: 3 },
      },
      testSchedule: { frequency: 'annually', type: 'tabletop', requiredParticipants: [] },
    },
  },
  deployment: {
    pipeline: {
      stages: [
        { name: 'build', type: 'build', required: true, timeout: 300, retries: 0 },
        { name: 'deploy', type: 'deploy', required: true, timeout: 300, retries: 0, dependsOn: ['build'] },
      ],
      qualityGates: [],
      environments: [
        { name: 'production', type: 'production', autoPromote: true },
      ],
      approvals: [],
      artifacts: { registry: 'local', retention: { production: 7, staging: 3, development: 1 }, signing: false, scanEnabled: false },
    },
    strategy: 'recreate',
    featureFlags: {
      provider: 'custom',
      defaultState: 'on',
      targetingRules: [],
      stalePolicy: { enabled: false, staleAfterDays: 90, action: 'notify' },
      auditEnabled: false,
      lifecycle: { requireDescription: false, requireOwner: false, requireExpiryDate: false },
    },
    rollback: {
      automatic: false,
      triggers: [],
      maxRollbackTime: 600,
      dataRollbackStrategy: 'none',
      versionRetention: 2,
    },
  },
  secOps: {
    vulnerabilityManagement: {
      scanning: {
        frequency: 'weekly',
        scanTypes: ['dependency'],
        blockOnSeverity: 'none',
        scanners: [],
      },
      remediationSLA: {
        critical: { hours: 168, escalateAfterHours: 120 },
        high: { hours: 336, escalateAfterHours: 240 },
        medium: { hours: 720, escalateAfterHours: 480 },
        low: { hours: 2160, escalateAfterHours: 1440 },
      },
      exceptionPolicy: { allowExceptions: true, maxExceptionDays: 90, requiredApprovers: 1, requireJustification: false, reviewCadence: 'quarterly' },
    },
    secretsManagement: {
      provider: 'doppler',
      rotationPolicy: { enabled: false, defaultIntervalDays: 365, gracePeriodHours: 168, notifyBeforeDays: 30 },
      categories: [],
      accessPolicy: { requireMFA: false, maxAccessDuration: 86400, justInTimeAccess: false, approvalRequired: false, allowedServices: [] },
      audit: { logAccess: false, logRotation: false, alertOnAnomalousAccess: false, retentionDays: 30 },
    },
    accessControl: {
      authentication: {
        methods: [{ type: 'password', enabled: true, config: {} }],
        mfaPolicy: { required: false, methods: [] },
        session: { maxDurationHours: 168, idleTimeoutMinutes: 240, concurrentSessions: 'unlimited', requireReauthForSensitive: false },
      },
      authorization: {
        model: 'rbac',
        roles: [{ name: 'admin', description: 'Full access', permissions: ['admin'] }],
        permissions: [],
        enforcement: 'service',
      },
      accessReview: { enabled: false, frequency: 'annually', reviewers: [], autoRevoke: false, reminderDays: [] },
    },
    auditLogging: {
      auditedEvents: [
        { category: 'authentication', events: ['login'], includePayload: false },
      ],
      destination: { type: 'custom', config: { path: '/var/log/audit.log' } },
      retention: { hotStorageDays: 7, warmStorageDays: 0, coldStorageDays: 0, deleteAfterDays: 30 },
      tamperProtection: { enabled: false, method: 'hash_chain', verificationFrequency: 'weekly' },
      alertRules: [],
    },
  },
  metadata: {
    version: '1.0.0',
    name: 'Minimal Configuration',
    description: 'Basic operational excellence configuration for development or early-stage projects',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: 'developer',
    tags: ['minimal', 'development', 'basic'],
  },
});

/**
 * Creates a custom operational excellence configuration by merging with a preset
 */
export function createOperationalExcellenceConfig(
  preset: 'enterprise' | 'startup' | 'minimal',
  overrides?: Partial<OperationalExcellenceConfig>
): OperationalExcellenceConfig {
  const baseConfig = preset === 'enterprise' ? ENTERPRISE_CONFIG :
                     preset === 'startup' ? STARTUP_CONFIG :
                     MINIMAL_CONFIG;

  if (!overrides) {
    return { ...baseConfig };
  }

  return {
    observability: { ...baseConfig.observability, ...overrides.observability } as ObservabilityConfig,
    reliability: { ...baseConfig.reliability, ...overrides.reliability } as ReliabilityConfig,
    deployment: { ...baseConfig.deployment, ...overrides.deployment } as DeploymentConfig,
    secOps: { ...baseConfig.secOps, ...overrides.secOps } as SecOpsConfig,
    metadata: {
      ...baseConfig.metadata,
      ...overrides.metadata,
      updatedAt: new Date().toISOString(),
    } as ConfigMetadata,
  };
}
