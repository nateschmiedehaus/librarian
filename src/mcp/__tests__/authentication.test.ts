/**
 * @fileoverview Tests for MCP Authentication Module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AuthenticationManager,
  createAuthenticationManager,
  getToolAuthorization,
  checkToolScopes,
  getAvailableTools,
  computeRequiredScopes,
  DEFAULT_AUTH_CONFIG,
  type TokenOptions,
  type AuthenticationConfig,
} from '../authentication.js';
import type { AuthorizationScope } from '../types.js';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('MCP Authentication', () => {
  let authManager: AuthenticationManager;

  beforeEach(() => {
    authManager = createAuthenticationManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // SESSION CREATION
  // ============================================================================

  describe('session creation', () => {
    it('should create a session with valid options', () => {
      const options: TokenOptions = {
        scopes: ['read'],
        clientId: 'test-client',
      };

      const { token, session } = authManager.createSession(options);

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(20);
      expect(session.id).toMatch(/^sess_/);
      expect(session.scopes).toEqual(['read']);
      expect(session.clientId).toBe('test-client');
    });

    it('should create session with multiple scopes', () => {
      const options: TokenOptions = {
        scopes: ['read', 'write', 'execute'],
        clientId: 'test-client',
      };

      const { session } = authManager.createSession(options);

      expect(session.scopes).toEqual(['read', 'write', 'execute']);
    });

    it('should set correct expiration time', () => {
      const ttlMs = 5 * 60 * 1000; // 5 minutes
      const options: TokenOptions = {
        scopes: ['read'],
        clientId: 'test-client',
        ttlMs,
      };

      const { session } = authManager.createSession(options);
      const expectedExpiry = session.createdAt.getTime() + ttlMs;

      expect(session.expiresAt.getTime()).toBe(expectedExpiry);
    });

    it('should cap TTL at maximum', () => {
      const options: TokenOptions = {
        scopes: ['read'],
        clientId: 'test-client',
        ttlMs: 48 * 60 * 60 * 1000, // 48 hours (exceeds max)
      };

      const { session } = authManager.createSession(options);
      const maxExpiry = session.createdAt.getTime() + DEFAULT_AUTH_CONFIG.maxTtlMs;

      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(maxExpiry);
    });

    it('should include allowed workspaces in metadata', () => {
      const options: TokenOptions = {
        scopes: ['read'],
        clientId: 'test-client',
        allowedWorkspaces: ['/path/to/workspace1', '/path/to/workspace2'],
      };

      const { session } = authManager.createSession(options);

      expect(session.metadata.allowedWorkspaces).toEqual([
        '/path/to/workspace1',
        '/path/to/workspace2',
      ]);
    });

    it('should evict oldest session when limit reached', () => {
      const manager = createAuthenticationManager({ maxSessionsPerClient: 2 });

      // Create 2 sessions
      const { session: session1 } = manager.createSession({
        scopes: ['read'],
        clientId: 'client1',
      });

      const { session: session2 } = manager.createSession({
        scopes: ['read'],
        clientId: 'client1',
      });

      // Create 3rd session - should evict session1
      const { session: session3 } = manager.createSession({
        scopes: ['read'],
        clientId: 'client1',
      });

      expect(manager.getSession(session1.id)).toBeNull();
      expect(manager.getSession(session2.id)).not.toBeNull();
      expect(manager.getSession(session3.id)).not.toBeNull();
    });
  });

  // ============================================================================
  // TOKEN VALIDATION
  // ============================================================================

  describe('token validation', () => {
    it('should validate a valid token', () => {
      const { token, session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
      });

      const validated = authManager.validateToken(token);

      expect(validated).not.toBeNull();
      expect(validated!.id).toBe(session.id);
    });

    it('should reject invalid token', () => {
      const validated = authManager.validateToken('invalid-token');

      expect(validated).toBeNull();
    });

    it('should reject expired token', () => {
      const manager = createAuthenticationManager();

      const { token, session } = manager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
        ttlMs: 100, // 100ms
      });

      // Wait for expiration
      vi.useFakeTimers();
      vi.advanceTimersByTime(200);

      const validated = manager.validateToken(token);

      expect(validated).toBeNull();

      vi.useRealTimers();
    });

    it('should reject inactive session', () => {
      const manager = createAuthenticationManager({
        inactivityTimeoutMs: 100,
      });

      const { token } = manager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
      });

      // Wait for inactivity timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(200);

      const validated = manager.validateToken(token);

      expect(validated).toBeNull();

      vi.useRealTimers();
    });

    it('should update lastActivityAt on validation', () => {
      const { token, session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
      });

      const initialActivity = session.lastActivityAt.getTime();

      // Small delay
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      authManager.validateToken(token);
      const updatedSession = authManager.getSession(session.id);

      expect(updatedSession!.lastActivityAt.getTime()).toBeGreaterThan(initialActivity);

      vi.useRealTimers();
    });
  });

  // ============================================================================
  // SESSION REFRESH
  // ============================================================================

  describe('session refresh', () => {
    it('should extend session expiration', () => {
      const { session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
        ttlMs: 60000, // 1 minute
      });

      const originalExpiry = session.expiresAt.getTime();

      vi.useFakeTimers();
      vi.advanceTimersByTime(30000); // 30 seconds

      const refreshed = authManager.refreshSession(session.id);

      expect(refreshed).not.toBeNull();
      expect(refreshed!.expiresAt.getTime()).toBeGreaterThan(originalExpiry);

      vi.useRealTimers();
    });

    it('should not refresh expired session', () => {
      const { session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
        ttlMs: 100,
      });

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);

      const refreshed = authManager.refreshSession(session.id);

      expect(refreshed).toBeNull();

      vi.useRealTimers();
    });

    it('should not refresh non-existent session', () => {
      const refreshed = authManager.refreshSession('non-existent');

      expect(refreshed).toBeNull();
    });
  });

  // ============================================================================
  // SESSION REVOCATION
  // ============================================================================

  describe('session revocation', () => {
    it('should revoke a session', () => {
      const { token, session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
      });

      const result = authManager.revokeSession(session.id);

      expect(result).toBe(true);
      expect(authManager.validateToken(token)).toBeNull();
      expect(authManager.getSession(session.id)).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const result = authManager.revokeSession('non-existent');

      expect(result).toBe(false);
    });

    it('should revoke all client sessions', () => {
      const { session: session1 } = authManager.createSession({
        scopes: ['read'],
        clientId: 'client1',
      });

      const { session: session2 } = authManager.createSession({
        scopes: ['read'],
        clientId: 'client1',
      });

      const { session: session3 } = authManager.createSession({
        scopes: ['read'],
        clientId: 'client2', // Different client
      });

      const revoked = authManager.revokeClientSessions('client1');

      expect(revoked).toBe(2);
      expect(authManager.getSession(session1.id)).toBeNull();
      expect(authManager.getSession(session2.id)).toBeNull();
      expect(authManager.getSession(session3.id)).not.toBeNull();
    });
  });

  // ============================================================================
  // AUTHORIZATION
  // ============================================================================

  describe('authorization', () => {
    it('should authorize read-only tools with read scope', () => {
      const { session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
      });

      const result = authManager.authorize(session, 'query');

      expect(result.authorized).toBe(true);
      expect(result.sessionId).toBe(session.id);
    });

    it('should deny tools requiring write scope', () => {
      const { session } = authManager.createSession({
        scopes: ['read'], // Only read
        clientId: 'test-client',
      });

      const result = authManager.authorize(session, 'bootstrap');

      expect(result.authorized).toBe(false);
      expect(result.missingScopes).toContain('write');
    });

    it('should deny unknown tools', () => {
      const { session } = authManager.createSession({
        scopes: ['read', 'write', 'admin'],
        clientId: 'test-client',
      });

      const result = authManager.authorize(session, 'unknown_tool');

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('Unknown tool');
    });

    it('should require consent for high-risk operations', () => {
      const { session } = authManager.createSession({
        scopes: ['read', 'write'],
        clientId: 'test-client',
      });

      const result = authManager.authorize(session, 'bootstrap');

      expect(result.authorized).toBe(false);
      expect(result.requiresConsent).toBe(true);
      expect(result.consentMessage).toBeDefined();
    });

    it('should authorize after consent granted', () => {
      const { session } = authManager.createSession({
        scopes: ['read', 'write'],
        clientId: 'test-client',
      });

      // First attempt - requires consent
      const result1 = authManager.authorize(session, 'bootstrap');
      expect(result1.requiresConsent).toBe(true);

      // Grant consent
      authManager.grantConsent(session.id, 'bootstrap');

      // Second attempt - should be authorized
      const result2 = authManager.authorize(session, 'bootstrap');
      expect(result2.authorized).toBe(true);
    });

    it('should deny workspace not in allowed list', () => {
      const { session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
        allowedWorkspaces: ['/allowed/workspace'],
      });

      const result = authManager.authorize(session, 'query', '/forbidden/workspace');

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('Workspace not allowed');
    });

    it('should allow workspace in allowed list', () => {
      const { session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
        allowedWorkspaces: ['/allowed/workspace'],
      });

      const result = authManager.authorize(session, 'query', '/allowed/workspace');

      expect(result.authorized).toBe(true);
    });

    it('should allow any workspace when list is empty', () => {
      const { session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
        allowedWorkspaces: [], // Empty = no restriction
      });

      const result = authManager.authorize(session, 'query', '/any/workspace');

      expect(result.authorized).toBe(true);
    });
  });

  // ============================================================================
  // CONSENT MANAGEMENT
  // ============================================================================

  describe('consent management', () => {
    it('should grant consent for operation', () => {
      const { session } = authManager.createSession({
        scopes: ['read', 'write'],
        clientId: 'test-client',
      });

      const result = authManager.grantConsent(session.id, 'bootstrap');

      expect(result).toBe(true);
      expect(session.metadata.consentedOperations.has('bootstrap')).toBe(true);
    });

    it('should revoke consent for operation', () => {
      const { session } = authManager.createSession({
        scopes: ['read', 'write'],
        clientId: 'test-client',
      });

      authManager.grantConsent(session.id, 'bootstrap');
      const result = authManager.revokeConsent(session.id, 'bootstrap');

      expect(result).toBe(true);
      expect(session.metadata.consentedOperations.has('bootstrap')).toBe(false);
    });

    it('should return false for non-existent session', () => {
      const grantResult = authManager.grantConsent('non-existent', 'bootstrap');
      const revokeResult = authManager.revokeConsent('non-existent', 'bootstrap');

      expect(grantResult).toBe(false);
      expect(revokeResult).toBe(false);
    });
  });

  // ============================================================================
  // SCOPE CHECKING
  // ============================================================================

  describe('scope checking', () => {
    it('should check if session has required scopes', () => {
      const { session } = authManager.createSession({
        scopes: ['read', 'write'],
        clientId: 'test-client',
      });

      expect(authManager.hasScopes(session, ['read'])).toBe(true);
      expect(authManager.hasScopes(session, ['read', 'write'])).toBe(true);
      expect(authManager.hasScopes(session, ['admin'])).toBe(false);
    });

    it('should not escalate scopes by default', () => {
      const { session: adminSession, token: adminToken } = authManager.createSession({
        scopes: ['admin'],
        clientId: 'admin-client',
      });

      const { session: userSession } = authManager.createSession({
        scopes: ['read'],
        clientId: 'user-client',
      });

      const result = authManager.escalateScopes(userSession.id, ['write'], adminToken);

      expect(result).toBe(false);
    });

    it('should escalate scopes when allowed', () => {
      const manager = createAuthenticationManager({ allowScopeEscalation: true });

      const { token: adminToken } = manager.createSession({
        scopes: ['admin'],
        clientId: 'admin-client',
      });

      const { session: userSession } = manager.createSession({
        scopes: ['read'],
        clientId: 'user-client',
      });

      const result = manager.escalateScopes(userSession.id, ['write'], adminToken);

      expect(result).toBe(true);
      expect(userSession.scopes).toContain('write');
    });
  });

  // ============================================================================
  // SESSION QUERIES
  // ============================================================================

  describe('session queries', () => {
    it('should get session by ID', () => {
      const { session } = authManager.createSession({
        scopes: ['read'],
        clientId: 'test-client',
      });

      const retrieved = authManager.getSession(session.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(session.id);
    });

    it('should return null for non-existent session', () => {
      const retrieved = authManager.getSession('non-existent');

      expect(retrieved).toBeNull();
    });

    it('should get all client sessions', () => {
      authManager.createSession({
        scopes: ['read'],
        clientId: 'client1',
      });

      authManager.createSession({
        scopes: ['write'],
        clientId: 'client1',
      });

      authManager.createSession({
        scopes: ['read'],
        clientId: 'client2',
      });

      const client1Sessions = authManager.getClientSessions('client1');

      expect(client1Sessions).toHaveLength(2);
    });

    it('should return empty array for unknown client', () => {
      const sessions = authManager.getClientSessions('unknown-client');

      expect(sessions).toEqual([]);
    });

    it('should return correct stats', () => {
      authManager.createSession({ scopes: ['read'], clientId: 'client1' });
      authManager.createSession({ scopes: ['read'], clientId: 'client1' });
      authManager.createSession({ scopes: ['read'], clientId: 'client2' });

      const stats = authManager.getStats();

      expect(stats.totalSessions).toBe(3);
      expect(stats.activeClients).toBe(2);
      expect(stats.expiredSessions).toBe(0);
    });
  });

  // ============================================================================
  // CLEANUP
  // ============================================================================

  describe('cleanup', () => {
    it('should clean up expired sessions', () => {
      const manager = createAuthenticationManager();

      manager.createSession({
        scopes: ['read'],
        clientId: 'client1',
        ttlMs: 100,
      });

      manager.createSession({
        scopes: ['read'],
        clientId: 'client2',
        ttlMs: 100000, // Long TTL
      });

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);

      const cleaned = manager.cleanup();

      expect(cleaned).toBe(1);
      expect(manager.getStats().totalSessions).toBe(1);

      vi.useRealTimers();
    });

    it('should clean up inactive sessions', () => {
      const manager = createAuthenticationManager({
        inactivityTimeoutMs: 100,
      });

      manager.createSession({
        scopes: ['read'],
        clientId: 'client1',
      });

      vi.useFakeTimers();
      vi.advanceTimersByTime(200);

      const cleaned = manager.cleanup();

      expect(cleaned).toBe(1);

      vi.useRealTimers();
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Authorization Helpers', () => {
  describe('getToolAuthorization', () => {
    it('should return authorization for known tool', () => {
      const auth = getToolAuthorization('query');

      expect(auth).not.toBeNull();
      expect(auth!.tool).toBe('query');
      expect(auth!.requiredScopes).toContain('read');
    });

    it('should return null for unknown tool', () => {
      const auth = getToolAuthorization('unknown_tool');

      expect(auth).toBeNull();
    });
  });

  describe('checkToolScopes', () => {
    it('should report satisfied when all scopes present', () => {
      const result = checkToolScopes('query', ['read', 'write']);

      expect(result.satisfied).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should report missing scopes', () => {
      const result = checkToolScopes('bootstrap', ['read']);

      expect(result.satisfied).toBe(false);
      expect(result.missing).toContain('write');
    });

    it('should handle unknown tool', () => {
      const result = checkToolScopes('unknown', ['read']);

      expect(result.satisfied).toBe(false);
    });
  });

  describe('getAvailableTools', () => {
    it('should return read-only tools for read scope', () => {
      const tools = getAvailableTools(['read']);

      expect(tools).toContain('query');
      expect(tools).toContain('verify_claim');
      expect(tools).not.toContain('bootstrap');
    });

    it('should return more tools with write scope', () => {
      const tools = getAvailableTools(['read', 'write']);

      expect(tools).toContain('query');
      expect(tools).toContain('bootstrap');
    });
  });

  describe('computeRequiredScopes', () => {
    it('should compute minimum scopes for tools', () => {
      const scopes = computeRequiredScopes(['query', 'verify_claim']);

      expect(scopes).toContain('read');
      expect(scopes).not.toContain('write');
    });

    it('should include all required scopes', () => {
      const scopes = computeRequiredScopes(['query', 'bootstrap']);

      expect(scopes).toContain('read');
      expect(scopes).toContain('write');
    });

    it('should handle empty tool list', () => {
      const scopes = computeRequiredScopes([]);

      expect(scopes).toEqual([]);
    });
  });
});
