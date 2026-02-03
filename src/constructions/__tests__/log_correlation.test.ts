/**
 * @fileoverview Tests for log parsing, correlation, and runtime state analysis
 *
 * Tests the log correlation features added to the Bug Investigation Assistant:
 * - Log file parsing (multiple formats)
 * - Log-stack frame correlation
 * - Runtime state analysis from crash dumps
 * - Enhanced hypothesis generation with log context
 */

import { describe, it, expect } from 'vitest';
import {
  parseLogFile,
  correlateLogsWithStack,
  parseNodeCrashDump,
  analyzeRuntimeState,
  generateHypothesesWithLogs,
  LOG_PATTERNS,
  type LogEntry,
  type StackFrame,
  type RuntimeState,
} from '../bug_investigation_assistant.js';

// ============================================================================
// SAMPLE LOG DATA
// ============================================================================

const SAMPLE_LOGS = {
  standard: `
[2024-01-15T10:30:00.000] [INFO] Application starting
[2024-01-15T10:30:01.123] [DEBUG] Loading configuration
[2024-01-15T10:30:02.456] [WARN] Database connection slow
[2024-01-15T10:30:03.789] [ERROR] Failed to connect to service: ECONNREFUSED
[2024-01-15T10:30:04.000] [ERROR] Unhandled error in processRequest
`,

  winston: `
2024-01-15T10:30:00.000Z info: Application starting
2024-01-15T10:30:01.123Z debug: Loading configuration
2024-01-15T10:30:02.456Z warn: Database connection slow
2024-01-15T10:30:03.789Z error: Failed to connect to service
`,

  pino: `
{"level":30,"time":1705312200000,"msg":"Application starting"}
{"level":20,"time":1705312201123,"msg":"Loading configuration"}
{"level":40,"time":1705312202456,"msg":"Database connection slow"}
{"level":50,"time":1705312203789,"msg":"Failed to connect to service"}
`,

  bunyan: `
{"name":"app","hostname":"localhost","pid":1234,"level":30,"msg":"Application starting","time":"2024-01-15T10:30:00.000Z"}
{"name":"app","hostname":"localhost","pid":1234,"level":50,"msg":"Failed to connect","time":"2024-01-15T10:30:03.789Z"}
`,
};

const SAMPLE_STACK_FRAMES: StackFrame[] = [
  {
    function: 'processRequest',
    file: '/app/src/handlers/request.ts',
    line: 45,
    language: 'javascript',
  },
  {
    function: 'connectToService',
    file: '/app/src/services/connection.ts',
    line: 23,
    language: 'javascript',
  },
  {
    function: 'handleError',
    file: '/app/src/utils/error.ts',
    line: 12,
    language: 'javascript',
  },
];

const SAMPLE_NODE_CRASH_DUMP = {
  javascriptStack: {
    message: 'Error: ECONNREFUSED',
    stack: [
      {
        funcName: 'processRequest',
        sourceLocation: {
          fileName: '/app/src/handlers/request.ts',
          lineNumber: 45,
          columnNumber: 12,
        },
      },
      {
        funcName: 'connectToService',
        sourceLocation: {
          fileName: '/app/src/services/connection.ts',
          lineNumber: 23,
        },
      },
    ],
    errorProperties: {
      code: 'ECONNREFUSED',
      errno: -111,
    },
  },
  javascriptHeap: {
    usedMemory: 52428800, // 50MB
    totalMemory: 67108864, // 64MB
    externalMemory: 1048576, // 1MB
  },
  libuv: Array(150).fill({ type: 'tcp' }), // 150 handles
};

// ============================================================================
// LOG PATTERNS TESTS
// ============================================================================

describe('LOG_PATTERNS', () => {
  it('should have patterns for all supported formats', () => {
    expect(LOG_PATTERNS).toHaveProperty('standard');
    expect(LOG_PATTERNS).toHaveProperty('winston');
    expect(LOG_PATTERNS).toHaveProperty('pino');
    expect(LOG_PATTERNS).toHaveProperty('bunyan');
  });

  it('should match standard format', () => {
    const line = '[2024-01-15T10:30:00.000] [ERROR] Test message';
    const match = line.match(LOG_PATTERNS.standard);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('2024-01-15T10:30:00.000');
    expect(match![2]).toBe('ERROR');
    expect(match![3]).toBe('Test message');
  });

  it('should match winston format', () => {
    const line = '2024-01-15T10:30:00.000Z error: Test message';
    const match = line.match(LOG_PATTERNS.winston);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('2024-01-15T10:30:00.000Z');
    expect(match![2]).toBe('error');
    expect(match![3]).toBe('Test message');
  });

  it('should match pino format', () => {
    const line = '{"level":50,"time":1705312200000,"msg":"Test message"}';
    const match = line.match(LOG_PATTERNS.pino);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('50');
    expect(match![2]).toBe('1705312200000');
    expect(match![3]).toBe('Test message');
  });

  it('should match bunyan format', () => {
    const line = '{"name":"app","hostname":"localhost","pid":123,"level":50,"msg":"Test message","time":"2024-01-15T10:30:00.000Z"}';
    const match = line.match(LOG_PATTERNS.bunyan);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('50');
    expect(match![2]).toBe('Test message');
    expect(match![3]).toBe('2024-01-15T10:30:00.000Z');
  });
});

// ============================================================================
// parseLogFile TESTS
// ============================================================================

describe('parseLogFile', () => {
  describe('standard format', () => {
    it('should parse standard format logs', () => {
      const entries = parseLogFile(SAMPLE_LOGS.standard);

      expect(entries.length).toBe(5);
      expect(entries[0].level).toBe('info');
      expect(entries[0].message).toBe('Application starting');
    });

    it('should correctly identify log levels', () => {
      const entries = parseLogFile(SAMPLE_LOGS.standard);

      expect(entries[0].level).toBe('info');
      expect(entries[1].level).toBe('debug');
      expect(entries[2].level).toBe('warn');
      expect(entries[3].level).toBe('error');
    });

    it('should parse timestamps correctly', () => {
      const entries = parseLogFile(SAMPLE_LOGS.standard);

      expect(entries[0].timestamp).toBeInstanceOf(Date);
      expect(entries[0].timestamp.getUTCFullYear()).toBe(2024);
      expect(entries[0].timestamp.getUTCMonth()).toBe(0); // January
      expect(entries[0].timestamp.getUTCDate()).toBe(15);
    });
  });

  describe('winston format', () => {
    it('should parse winston format logs', () => {
      const entries = parseLogFile(SAMPLE_LOGS.winston);

      expect(entries.length).toBe(4);
      expect(entries[0].level).toBe('info');
      expect(entries[0].message).toBe('Application starting');
    });

    it('should correctly identify log levels', () => {
      const entries = parseLogFile(SAMPLE_LOGS.winston);

      expect(entries[0].level).toBe('info');
      expect(entries[1].level).toBe('debug');
      expect(entries[2].level).toBe('warn');
      expect(entries[3].level).toBe('error');
    });
  });

  describe('pino format', () => {
    it('should parse pino JSON format logs', () => {
      const entries = parseLogFile(SAMPLE_LOGS.pino);

      expect(entries.length).toBe(4);
      expect(entries[0].message).toBe('Application starting');
    });

    it('should convert pino numeric levels to strings', () => {
      const entries = parseLogFile(SAMPLE_LOGS.pino);

      expect(entries[0].level).toBe('info'); // level 30
      expect(entries[1].level).toBe('debug'); // level 20
      expect(entries[2].level).toBe('warn'); // level 40
      expect(entries[3].level).toBe('error'); // level 50
    });
  });

  describe('bunyan format', () => {
    it('should parse bunyan JSON format logs', () => {
      const entries = parseLogFile(SAMPLE_LOGS.bunyan);

      expect(entries.length).toBe(2);
      expect(entries[0].message).toBe('Application starting');
      expect(entries[1].message).toBe('Failed to connect');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', () => {
      const entries = parseLogFile('');
      expect(entries).toEqual([]);
    });

    it('should skip non-matching lines', () => {
      const mixedContent = `
Some random text
[2024-01-15T10:30:00.000] [INFO] Valid log entry
More random text
`;
      const entries = parseLogFile(mixedContent);
      expect(entries.length).toBe(1);
      expect(entries[0].message).toBe('Valid log entry');
    });

    it('should sort entries by timestamp', () => {
      const unsortedLogs = `
[2024-01-15T10:30:03.000] [INFO] Third
[2024-01-15T10:30:01.000] [INFO] First
[2024-01-15T10:30:02.000] [INFO] Second
`;
      const entries = parseLogFile(unsortedLogs);
      expect(entries[0].message).toBe('First');
      expect(entries[1].message).toBe('Second');
      expect(entries[2].message).toBe('Third');
    });
  });
});

// ============================================================================
// correlateLogsWithStack TESTS
// ============================================================================

describe('correlateLogsWithStack', () => {
  it('should correlate logs mentioning function names', () => {
    const logs: LogEntry[] = [
      {
        timestamp: new Date('2024-01-15T10:30:00.000Z'),
        level: 'info',
        message: 'Starting processRequest handler',
      },
      {
        timestamp: new Date('2024-01-15T10:30:01.000Z'),
        level: 'error',
        message: 'Error in connectToService: connection refused',
      },
    ];

    const correlation = correlateLogsWithStack(logs, SAMPLE_STACK_FRAMES);

    expect(correlation.correlatedEntries.length).toBeGreaterThan(0);

    // Should find correlation for processRequest
    const processRequestCorrelation = correlation.correlatedEntries.find(
      c => c.frame.function === 'processRequest'
    );
    expect(processRequestCorrelation).toBeDefined();
    expect(processRequestCorrelation!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should correlate logs mentioning file paths', () => {
    const logs: LogEntry[] = [
      {
        timestamp: new Date('2024-01-15T10:30:00.000Z'),
        level: 'error',
        message: 'Error in /app/src/handlers/request.ts',
      },
    ];

    const correlation = correlateLogsWithStack(logs, SAMPLE_STACK_FRAMES);

    const fileCorrelation = correlation.correlatedEntries.find(
      c => c.frame.file === '/app/src/handlers/request.ts'
    );
    expect(fileCorrelation).toBeDefined();
    expect(fileCorrelation!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should build timeline from logs near crash time', () => {
    const crashTime = new Date('2024-01-15T10:30:05.000Z');
    const logs: LogEntry[] = [
      {
        timestamp: new Date('2024-01-15T10:29:00.000Z'), // Too early
        level: 'info',
        message: 'Early log',
      },
      {
        timestamp: new Date('2024-01-15T10:30:00.000Z'), // Within 1 minute
        level: 'info',
        message: 'Recent log 1',
      },
      {
        timestamp: new Date('2024-01-15T10:30:03.000Z'), // Within 1 minute
        level: 'error',
        message: 'Recent log 2',
      },
    ];

    const correlation = correlateLogsWithStack(logs, SAMPLE_STACK_FRAMES, crashTime);

    // Timeline should only include logs within 1 minute of crash
    expect(correlation.timeline.length).toBe(2);
  });

  it('should include all log entries in logEntries field', () => {
    const logs: LogEntry[] = [
      { timestamp: new Date(), level: 'info', message: 'Log 1' },
      { timestamp: new Date(), level: 'info', message: 'Log 2' },
    ];

    const correlation = correlateLogsWithStack(logs, SAMPLE_STACK_FRAMES);

    expect(correlation.logEntries).toEqual(logs);
    expect(correlation.stackFrames).toEqual(SAMPLE_STACK_FRAMES);
  });

  it('should handle empty logs', () => {
    const correlation = correlateLogsWithStack([], SAMPLE_STACK_FRAMES);

    expect(correlation.logEntries).toEqual([]);
    expect(correlation.correlatedEntries).toEqual([]);
    expect(correlation.timeline).toEqual([]);
  });

  it('should handle empty stack frames', () => {
    const logs: LogEntry[] = [
      { timestamp: new Date(), level: 'error', message: 'Some error' },
    ];

    const correlation = correlateLogsWithStack(logs, []);

    expect(correlation.stackFrames).toEqual([]);
    expect(correlation.correlatedEntries).toEqual([]);
  });
});

// ============================================================================
// parseNodeCrashDump TESTS
// ============================================================================

describe('parseNodeCrashDump', () => {
  it('should parse a valid Node.js diagnostic report', () => {
    const dump = JSON.stringify(SAMPLE_NODE_CRASH_DUMP);
    const state = parseNodeCrashDump(dump);

    expect(state).not.toBeNull();
    expect(state!.variables.error).toBe('Error: ECONNREFUSED');
  });

  it('should extract call stack from report', () => {
    const dump = JSON.stringify(SAMPLE_NODE_CRASH_DUMP);
    const state = parseNodeCrashDump(dump);

    expect(state!.callStack.length).toBe(2);
    expect(state!.callStack[0].function).toBe('processRequest');
    expect(state!.callStack[0].file).toBe('/app/src/handlers/request.ts');
    expect(state!.callStack[0].line).toBe(45);
  });

  it('should extract heap summary', () => {
    const dump = JSON.stringify(SAMPLE_NODE_CRASH_DUMP);
    const state = parseNodeCrashDump(dump);

    expect(state!.heapSummary).toBeDefined();
    expect(state!.heapSummary!.used).toBe(52428800);
    expect(state!.heapSummary!.total).toBe(67108864);
    expect(state!.heapSummary!.external).toBe(1048576);
  });

  it('should extract active handles count', () => {
    const dump = JSON.stringify(SAMPLE_NODE_CRASH_DUMP);
    const state = parseNodeCrashDump(dump);

    expect(state!.activeHandles).toBe(150);
  });

  it('should extract error properties into variables', () => {
    const dump = JSON.stringify(SAMPLE_NODE_CRASH_DUMP);
    const state = parseNodeCrashDump(dump);

    expect(state!.variables.code).toBe('ECONNREFUSED');
    expect(state!.variables.errno).toBe(-111);
  });

  it('should return null for invalid JSON', () => {
    const state = parseNodeCrashDump('not valid json');
    expect(state).toBeNull();
  });

  it('should handle empty report', () => {
    const state = parseNodeCrashDump('{}');
    expect(state).not.toBeNull();
    expect(state!.callStack).toEqual([]);
    expect(state!.variables).toEqual({});
  });
});

// ============================================================================
// analyzeRuntimeState TESTS
// ============================================================================

describe('analyzeRuntimeState', () => {
  it('should detect memory exhaustion', () => {
    const state: RuntimeState = {
      variables: {},
      callStack: [],
      heapSummary: {
        used: 98 * 1024 * 1024, // 98MB - 98% usage, above 95% threshold
        total: 100 * 1024 * 1024, // 100MB
        external: 0,
      },
    };

    const issues = analyzeRuntimeState(state);

    const memoryIssue = issues.find(i => i.issue === 'Memory exhaustion');
    expect(memoryIssue).toBeDefined();
    expect(memoryIssue!.severity).toBe('high');
  });

  it('should detect high memory usage', () => {
    const state: RuntimeState = {
      variables: {},
      callStack: [],
      heapSummary: {
        used: 85 * 1024 * 1024, // 85MB
        total: 100 * 1024 * 1024, // 100MB
        external: 0,
      },
    };

    const issues = analyzeRuntimeState(state);

    const memoryIssue = issues.find(i => i.issue === 'High memory usage');
    expect(memoryIssue).toBeDefined();
    expect(memoryIssue!.severity).toBe('medium');
  });

  it('should detect high external memory', () => {
    const state: RuntimeState = {
      variables: {},
      callStack: [],
      heapSummary: {
        used: 50 * 1024 * 1024,
        total: 100 * 1024 * 1024,
        external: 30 * 1024 * 1024, // External > 50% of used
      },
    };

    const issues = analyzeRuntimeState(state);

    const externalIssue = issues.find(i => i.issue === 'High external memory');
    expect(externalIssue).toBeDefined();
    expect(externalIssue!.severity).toBe('medium');
  });

  it('should detect potential handle leaks', () => {
    const state: RuntimeState = {
      variables: {},
      callStack: [],
      activeHandles: 150,
    };

    const issues = analyzeRuntimeState(state);

    const handleIssue = issues.find(i => i.issue === 'Potential handle leak');
    expect(handleIssue).toBeDefined();
    expect(handleIssue!.severity).toBe('medium');
    expect(handleIssue!.details).toContain('150');
  });

  it('should detect out of memory errors', () => {
    const state: RuntimeState = {
      variables: { error: 'FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory' },
      callStack: [],
    };

    const issues = analyzeRuntimeState(state);

    const oomIssue = issues.find(i => i.issue === 'Out of memory error');
    expect(oomIssue).toBeDefined();
    expect(oomIssue!.severity).toBe('high');
  });

  it('should return empty array for healthy state', () => {
    const state: RuntimeState = {
      variables: {},
      callStack: [],
      heapSummary: {
        used: 30 * 1024 * 1024,
        total: 100 * 1024 * 1024,
        external: 1 * 1024 * 1024,
      },
      activeHandles: 10,
    };

    const issues = analyzeRuntimeState(state);

    expect(issues).toEqual([]);
  });
});

// ============================================================================
// generateHypothesesWithLogs TESTS
// ============================================================================

describe('generateHypothesesWithLogs', () => {
  it('should generate hypotheses from error logs', () => {
    const logs: LogEntry[] = [
      {
        timestamp: new Date('2024-01-15T10:30:00.000Z'),
        level: 'info',
        message: 'Normal operation',
      },
      {
        timestamp: new Date('2024-01-15T10:30:01.000Z'),
        level: 'error',
        message: 'Database connection failed: ECONNREFUSED',
      },
    ];

    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, logs);

    expect(hypotheses.length).toBeGreaterThan(0);
    const errorHypothesis = hypotheses.find(h => h.description.includes('Database connection failed'));
    expect(errorHypothesis).toBeDefined();
    expect(errorHypothesis!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should detect state mutation patterns', () => {
    const logs: LogEntry[] = [
      { timestamp: new Date(), level: 'info', message: 'User state changed to active' },
      { timestamp: new Date(), level: 'info', message: 'Status updated: pending -> processing' },
    ];

    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, logs);

    const stateHypothesis = hypotheses.find(h =>
      h.description.includes('State mutations detected')
    );
    expect(stateHypothesis).toBeDefined();
  });

  it('should detect repeated error patterns', () => {
    const logs: LogEntry[] = [];
    // Create 5 similar errors
    for (let i = 0; i < 5; i++) {
      logs.push({
        timestamp: new Date(Date.now() + i * 1000),
        level: 'error',
        message: `Connection to server failed: attempt ${i}`,
      });
    }

    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, logs);

    const repeatHypothesis = hypotheses.find(h =>
      h.description.includes('Repeated error pattern')
    );
    expect(repeatHypothesis).toBeDefined();
    expect(repeatHypothesis!.evidence[0]).toContain('appeared');
  });

  it('should detect timeout patterns', () => {
    const logs: LogEntry[] = [
      { timestamp: new Date(), level: 'warn', message: 'Request timed out after 30s' },
      { timestamp: new Date(), level: 'error', message: 'Operation exceeded deadline' },
    ];

    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, logs);

    const timeoutHypothesis = hypotheses.find(h =>
      h.description.includes('Timeout/latency')
    );
    expect(timeoutHypothesis).toBeDefined();
  });

  it('should detect network issues', () => {
    const logs: LogEntry[] = [
      { timestamp: new Date(), level: 'error', message: 'ECONNREFUSED: connection refused' },
      { timestamp: new Date(), level: 'error', message: 'Socket connection reset' },
    ];

    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, logs);

    const networkHypothesis = hypotheses.find(h =>
      h.description.includes('Network/connection')
    );
    expect(networkHypothesis).toBeDefined();
  });

  it('should sort hypotheses by confidence', () => {
    const logs: LogEntry[] = [
      { timestamp: new Date(), level: 'error', message: 'Critical failure occurred' },
      { timestamp: new Date(), level: 'info', message: 'State changed to error' },
    ];

    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, logs);

    // Verify descending confidence order
    for (let i = 1; i < hypotheses.length; i++) {
      expect(hypotheses[i - 1].confidence).toBeGreaterThanOrEqual(hypotheses[i].confidence);
    }
  });

  it('should handle empty logs', () => {
    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, []);
    expect(hypotheses).toEqual([]);
  });

  it('should truncate long messages in evidence', () => {
    const longMessage = 'A'.repeat(200);
    const logs: LogEntry[] = [
      { timestamp: new Date(), level: 'error', message: longMessage },
    ];

    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, logs);

    // Check that the description is truncated
    const errorHypothesis = hypotheses.find(h => h.evidence.length > 0);
    expect(errorHypothesis).toBeDefined();
    expect(errorHypothesis!.description.length).toBeLessThan(200);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Log Correlation Integration', () => {
  it('should work end-to-end with real-world scenario', () => {
    // Simulate a real crash scenario
    const logs = parseLogFile(SAMPLE_LOGS.standard);
    const correlation = correlateLogsWithStack(logs, SAMPLE_STACK_FRAMES);
    const hypotheses = generateHypothesesWithLogs(SAMPLE_STACK_FRAMES, logs);

    // Verify we got meaningful results
    expect(logs.length).toBeGreaterThan(0);
    expect(correlation.logEntries.length).toBe(logs.length);
    expect(hypotheses.length).toBeGreaterThan(0);

    // Error logs should generate hypotheses
    const errorLogs = logs.filter(l => l.level === 'error');
    expect(errorLogs.length).toBeGreaterThan(0);
  });

  it('should handle crash dump with logs together', () => {
    // Parse crash dump
    const dump = JSON.stringify(SAMPLE_NODE_CRASH_DUMP);
    const runtimeState = parseNodeCrashDump(dump);

    // Analyze runtime state
    const stateIssues = analyzeRuntimeState(runtimeState!);

    // Parse logs
    const logs = parseLogFile(SAMPLE_LOGS.standard);

    // Correlate with stack from crash dump
    const correlation = correlateLogsWithStack(logs, runtimeState!.callStack);

    // Generate hypotheses
    const hypotheses = generateHypothesesWithLogs(runtimeState!.callStack, logs);

    // Should have identified potential handle leak
    const handleIssue = stateIssues.find(i => i.issue === 'Potential handle leak');
    expect(handleIssue).toBeDefined();

    // Should have hypotheses from logs
    expect(hypotheses.length).toBeGreaterThan(0);
  });
});
