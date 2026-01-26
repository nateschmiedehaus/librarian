/**
 * @fileoverview MCP Authentication Module
 *
 * Provides session-based authentication and authorization for the MCP server:
 * - Session token generation and validation
 * - Scope-based authorization enforcement
 * - Token refresh and expiration handling
 * - Consent tracking for high-risk operations
 *
 * @packageDocumentation
 */

import { randomBytes, createHash } from 'crypto';
import {
  type AuthorizationScope,
  type ToolAuthorization,
  TOOL_AUTHORIZATION,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

/** Session token structure */
export interface SessionToken {
  /** Unique token ID */
  id: string;

  /** Token value (hashed for storage) */
  tokenHash: string;

  /** Granted scopes */
  scopes: AuthorizationScope[];

  /** Session creation time */
  createdAt: Date;

  /** Token expiration time */
  expiresAt: Date;

  /** Last activity time */
  lastActivityAt: Date;

  /** Client identifier */
  clientId: string;

  /** Session metadata */
  metadata: SessionMetadata;
}

/** Session metadata */
export interface SessionMetadata {
  /** Client user agent or identifier */
  userAgent?: string;

  /** Client IP address (hashed for privacy) */
  ipHash?: string;

  /** Workspace paths this session can access */
  allowedWorkspaces: string[];

  /** Consented operations */
  consentedOperations: Set<string>;

  /** Custom session data */
  custom?: Record<string, unknown>;
}

/** Token creation options */
export interface TokenOptions {
  /** Requested scopes */
  scopes: AuthorizationScope[];

  /** Client identifier */
  clientId: string;

  /** Token TTL in milliseconds (default: 1 hour) */
  ttlMs?: number;

  /** Allowed workspaces (empty = all registered) */
  allowedWorkspaces?: string[];

  /** Additional metadata */
  metadata?: Partial<SessionMetadata>;
}

/** Authorization result */
export interface AuthorizationResult {
  /** Whether authorization was granted */
  authorized: boolean;

  /** Session token ID (if authorized) */
  sessionId?: string;

  /** Reason for denial (if not authorized) */
  reason?: string;

  /** Missing scopes (if scope check failed) */
  missingScopes?: AuthorizationScope[];

  /** Whether consent is required */
  requiresConsent?: boolean;

  /** Consent message to display */
  consentMessage?: string;
}

/** Authentication configuration */
export interface AuthenticationConfig {
  /** Default token TTL in milliseconds */
  defaultTtlMs: number;

  /** Maximum token TTL in milliseconds */
  maxTtlMs: number;

  /** Session inactivity timeout in milliseconds */
  inactivityTimeoutMs: number;

  /** Maximum sessions per client */
  maxSessionsPerClient: number;

  /** Enable scope escalation (for admin) */
  allowScopeEscalation: boolean;

  /** Require workspace restriction */
  requireWorkspaceRestriction: boolean;
}

/** Default authentication configuration */
export const DEFAULT_AUTH_CONFIG: AuthenticationConfig = {
  defaultTtlMs: 60 * 60 * 1000, // 1 hour
  maxTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  inactivityTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxSessionsPerClient: 5,
  allowScopeEscalation: false,
  requireWorkspaceRestriction: false,
};

// ============================================================================
// AUTHENTICATION MANAGER
// ============================================================================

/**
 * Manages authentication and authorization for MCP sessions.
 */
export class AuthenticationManager {
  private sessions: Map<string, SessionToken> = new Map();
  private tokenToSession: Map<string, string> = new Map();
  private clientSessions: Map<string, Set<string>> = new Map();
  private config: AuthenticationConfig;

  constructor(config: Partial<AuthenticationConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
  }

  // ==========================================================================
  // TOKEN MANAGEMENT
  // ==========================================================================

  /**
   * Create a new session token.
   */
  createSession(options: TokenOptions): { token: string; session: SessionToken } {
    // Check client session limit
    const clientSessionCount = this.clientSessions.get(options.clientId)?.size ?? 0;
    if (clientSessionCount >= this.config.maxSessionsPerClient) {
      // Evict oldest session for this client
      this.evictOldestClientSession(options.clientId);
    }

    // Generate token
    const tokenValue = this.generateToken();
    const tokenHash = this.hashToken(tokenValue);
    const sessionId = this.generateSessionId();

    // Calculate TTL
    const ttlMs = Math.min(
      options.ttlMs ?? this.config.defaultTtlMs,
      this.config.maxTtlMs
    );

    const now = new Date();
    const session: SessionToken = {
      id: sessionId,
      tokenHash,
      scopes: [...options.scopes],
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      lastActivityAt: now,
      clientId: options.clientId,
      metadata: {
        allowedWorkspaces: options.allowedWorkspaces ?? [],
        consentedOperations: new Set(),
        ...options.metadata,
      },
    };

    // Store session
    this.sessions.set(sessionId, session);
    this.tokenToSession.set(tokenHash, sessionId);

    // Track client sessions
    if (!this.clientSessions.has(options.clientId)) {
      this.clientSessions.set(options.clientId, new Set());
    }
    this.clientSessions.get(options.clientId)!.add(sessionId);

    return { token: tokenValue, session };
  }

  /**
   * Validate a token and return the session if valid.
   */
  validateToken(token: string): SessionToken | null {
    const tokenHash = this.hashToken(token);
    const sessionId = this.tokenToSession.get(tokenHash);

    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      this.revokeSession(sessionId);
      return null;
    }

    // Check inactivity
    const inactiveMs = Date.now() - session.lastActivityAt.getTime();
    if (inactiveMs > this.config.inactivityTimeoutMs) {
      this.revokeSession(sessionId);
      return null;
    }

    // Update activity time
    session.lastActivityAt = new Date();

    return session;
  }

  /**
   * Refresh a session token, extending its expiration.
   */
  refreshSession(sessionId: string, extendMs?: number): SessionToken | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session is still valid
    if (new Date() > session.expiresAt) {
      this.revokeSession(sessionId);
      return null;
    }

    // Extend expiration
    const extension = Math.min(
      extendMs ?? this.config.defaultTtlMs,
      this.config.maxTtlMs - (Date.now() - session.createdAt.getTime())
    );

    session.expiresAt = new Date(Date.now() + extension);
    session.lastActivityAt = new Date();

    return session;
  }

  /**
   * Revoke a session.
   */
  revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove from all maps
    this.sessions.delete(sessionId);
    this.tokenToSession.delete(session.tokenHash);

    const clientSessions = this.clientSessions.get(session.clientId);
    if (clientSessions) {
      clientSessions.delete(sessionId);
      if (clientSessions.size === 0) {
        this.clientSessions.delete(session.clientId);
      }
    }

    return true;
  }

  /**
   * Revoke all sessions for a client.
   */
  revokeClientSessions(clientId: string): number {
    const sessionIds = this.clientSessions.get(clientId);
    if (!sessionIds) {
      return 0;
    }

    let revoked = 0;
    for (const sessionId of sessionIds) {
      if (this.revokeSession(sessionId)) {
        revoked++;
      }
    }

    return revoked;
  }

  // ==========================================================================
  // AUTHORIZATION
  // ==========================================================================

  /**
   * Check if a session is authorized to perform an operation.
   */
  authorize(
    session: SessionToken,
    toolName: string,
    workspace?: string
  ): AuthorizationResult {
    // Get tool authorization requirements
    const toolAuth = TOOL_AUTHORIZATION[toolName];
    if (!toolAuth) {
      return {
        authorized: false,
        reason: `Unknown tool: ${toolName}`,
      };
    }

    // Check workspace access
    if (workspace && session.metadata.allowedWorkspaces.length > 0) {
      // Normalize paths for comparison
      const normalizedWorkspace = workspace.replace(/\/$/, ''); // Remove trailing slash
      const workspaceAllowed = session.metadata.allowedWorkspaces.some((allowed) => {
        const normalizedAllowed = allowed.replace(/\/$/, '');
        // Allow exact match or if workspace is a subdirectory of allowed
        // Use path separator to prevent /foo matching /foobar
        return normalizedWorkspace === normalizedAllowed ||
               normalizedWorkspace.startsWith(normalizedAllowed + '/');
      });
      if (!workspaceAllowed) {
        return {
          authorized: false,
          sessionId: session.id,
          reason: `Workspace not allowed: ${workspace}`,
        };
      }
    }

    // Check required scopes
    const missingScopes = toolAuth.requiredScopes.filter(
      (scope) => !session.scopes.includes(scope)
    );

    if (missingScopes.length > 0) {
      return {
        authorized: false,
        sessionId: session.id,
        reason: 'Insufficient permissions',
        missingScopes,
      };
    }

    // Check consent requirement
    if (toolAuth.requiresConsent) {
      if (!session.metadata.consentedOperations.has(toolName)) {
        return {
          authorized: false,
          sessionId: session.id,
          reason: 'Consent required',
          requiresConsent: true,
          consentMessage: toolAuth.consentMessage,
        };
      }
    }

    return {
      authorized: true,
      sessionId: session.id,
    };
  }

  /**
   * Record consent for an operation.
   */
  grantConsent(sessionId: string, operation: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.metadata.consentedOperations.add(operation);
    return true;
  }

  /**
   * Revoke consent for an operation.
   */
  revokeConsent(sessionId: string, operation: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    return session.metadata.consentedOperations.delete(operation);
  }

  /**
   * Check if a scope set includes another scope set.
   */
  hasScopes(session: SessionToken, requiredScopes: AuthorizationScope[]): boolean {
    return requiredScopes.every((scope) => session.scopes.includes(scope));
  }

  /**
   * Escalate session scopes (admin only).
   */
  escalateScopes(
    sessionId: string,
    newScopes: AuthorizationScope[],
    adminToken: string
  ): boolean {
    if (!this.config.allowScopeEscalation) {
      return false;
    }

    // Validate admin token
    const adminSession = this.validateToken(adminToken);
    if (!adminSession || !adminSession.scopes.includes('admin')) {
      return false;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Add new scopes
    for (const scope of newScopes) {
      if (!session.scopes.includes(scope)) {
        session.scopes.push(scope);
      }
    }

    return true;
  }

  // ==========================================================================
  // SESSION QUERIES
  // ==========================================================================

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): SessionToken | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Get all sessions for a client.
   */
  getClientSessions(clientId: string): SessionToken[] {
    const sessionIds = this.clientSessions.get(clientId);
    if (!sessionIds) {
      return [];
    }

    const sessions: SessionToken[] = [];
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get session statistics.
   */
  getStats(): {
    totalSessions: number;
    activeClients: number;
    expiredSessions: number;
  } {
    let expiredSessions = 0;
    const now = new Date();

    for (const session of this.sessions.values()) {
      if (now > session.expiresAt) {
        expiredSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeClients: this.clientSessions.size,
      expiredSessions,
    };
  }

  /**
   * Clean up expired sessions.
   */
  cleanup(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      const expired = now > session.expiresAt;
      const inactive =
        now.getTime() - session.lastActivityAt.getTime() >
        this.config.inactivityTimeoutMs;

      if (expired || inactive) {
        this.revokeSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateSessionId(): string {
    return `sess_${randomBytes(16).toString('hex')}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private evictOldestClientSession(clientId: string): void {
    const sessionIds = this.clientSessions.get(clientId);
    if (!sessionIds || sessionIds.size === 0) {
      return;
    }

    let oldestSession: SessionToken | null = null;
    let oldestSessionId: string | null = null;

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        if (!oldestSession || session.createdAt < oldestSession.createdAt) {
          oldestSession = session;
          oldestSessionId = sessionId;
        }
      }
    }

    if (oldestSessionId) {
      this.revokeSession(oldestSessionId);
    }
  }
}

// ============================================================================
// AUTHORIZATION HELPERS
// ============================================================================

/**
 * Get the tool authorization definition.
 */
export function getToolAuthorization(toolName: string): ToolAuthorization | null {
  return TOOL_AUTHORIZATION[toolName] ?? null;
}

/**
 * Check if a scope set satisfies tool requirements.
 */
export function checkToolScopes(
  toolName: string,
  scopes: AuthorizationScope[]
): { satisfied: boolean; missing: AuthorizationScope[] } {
  const auth = TOOL_AUTHORIZATION[toolName];
  if (!auth) {
    return { satisfied: false, missing: [] };
  }

  const missing = auth.requiredScopes.filter((s) => !scopes.includes(s));
  return {
    satisfied: missing.length === 0,
    missing,
  };
}

/**
 * Get all tools available for a scope set.
 */
export function getAvailableTools(scopes: AuthorizationScope[]): string[] {
  const tools: string[] = [];

  for (const [toolName, auth] of Object.entries(TOOL_AUTHORIZATION)) {
    const { satisfied } = checkToolScopes(toolName, scopes);
    if (satisfied) {
      tools.push(toolName);
    }
  }

  return tools;
}

/**
 * Compute the minimum scope set needed for a set of tools.
 */
export function computeRequiredScopes(toolNames: string[]): AuthorizationScope[] {
  const scopeSet = new Set<AuthorizationScope>();

  for (const toolName of toolNames) {
    const auth = TOOL_AUTHORIZATION[toolName];
    if (auth) {
      for (const scope of auth.requiredScopes) {
        scopeSet.add(scope);
      }
    }
  }

  return Array.from(scopeSet);
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an authentication manager with configuration.
 */
export function createAuthenticationManager(
  config?: Partial<AuthenticationConfig>
): AuthenticationManager {
  return new AuthenticationManager(config);
}
