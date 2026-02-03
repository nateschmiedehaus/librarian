/**
 * @fileoverview Tests for multi-format stack trace parsing
 *
 * Tests the parseStackFrame, parseStackTrace, and detectStackTraceLanguage
 * functions for various stack trace formats:
 * - Node.js
 * - Chrome
 * - Firefox
 * - Python
 * - Java
 * - Ruby
 * - Go
 */

import { describe, it, expect } from 'vitest';
import {
  parseStackFrame,
  parseStackTrace,
  detectStackTraceLanguage,
  STACK_PATTERNS,
  type StackFrame,
} from '../bug_investigation_assistant.js';

// ============================================================================
// SAMPLE STACK TRACES
// ============================================================================

const SAMPLE_STACK_TRACES = {
  nodejs: `Error: Something went wrong
    at processTicksAndRejections (internal/process/task_queues.js:93:5)
    at async UserService.getUser (/app/src/services/user.ts:45:12)
    at async UserController.handleRequest (/app/src/controllers/user.ts:23:8)
    at /app/src/middleware/auth.ts:15:20`,

  chrome: `TypeError: Cannot read property 'foo' of undefined
    at handleClick@http://localhost:3000/static/js/main.js:123:45
    at HTMLButtonElement.onclick@http://localhost:3000/static/js/main.js:100:12
    @http://localhost:3000/static/js/vendor.js:50:30`,

  firefox: `TypeError: e is undefined
    handleClick@http://localhost:3000/static/js/main.js:123:45
    onclick@http://localhost:3000/static/js/main.js:100:12
    @http://localhost:3000/static/js/vendor.js:50:30`,

  python: `Traceback (most recent call last):
  File "/app/main.py", line 42, in main
    result = process_data(data)
  File "/app/processor.py", line 15, in process_data
    return transform(data)
  File "/app/utils.py", line 8, in transform
    raise ValueError("Invalid data format")
ValueError: Invalid data format`,

  java: `java.lang.NullPointerException: Cannot invoke method on null
    at com.example.service.UserService.getUser(UserService.java:45)
    at com.example.controller.UserController.handleRequest(UserController.java:23)
    at com.example.filter.AuthFilter.doFilter(AuthFilter.java:15)
    at org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:166)`,

  ruby: `app/controllers/users_controller.rb:15:in \`show'
app/middleware/auth.rb:8:in \`call'
lib/rack/session.rb:42:in \`call'
config/initializers/custom.rb:10:in \`initialize'`,

  go: `goroutine 1 [running]:
main.(*Server).handleRequest(0xc000010230, 0xc000014120)
    /app/server.go:45 +0x1a5
main.(*Router).ServeHTTP(0xc000010230, 0x7f9b8c0080a0, 0xc000014120)
    /app/router.go:23 +0x89
net/http.serverHandler.ServeHTTP(0xc00005e000, 0x7f9b8c0080a0, 0xc000014120)
    /usr/local/go/src/net/http/server.go:2843 +0x316`,
};

// ============================================================================
// parseStackFrame TESTS
// ============================================================================

describe('parseStackFrame', () => {
  describe('Node.js format', () => {
    it('should parse standard Node.js frame with function name', () => {
      const line = '    at UserService.getUser (/app/src/services/user.ts:45:12)';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('UserService.getUser');
      expect(frame!.file).toBe('/app/src/services/user.ts');
      expect(frame!.line).toBe(45);
      expect(frame!.column).toBe(12);
      expect(frame!.language).toBe('javascript');
    });

    it('should parse Node.js frame without function name', () => {
      const line = '    at /app/src/middleware/auth.ts:15:20';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('<anonymous>');
      expect(frame!.file).toBe('/app/src/middleware/auth.ts');
      expect(frame!.line).toBe(15);
      expect(frame!.column).toBe(20);
      expect(frame!.language).toBe('javascript');
    });

    it('should parse Node.js async frame', () => {
      const line = '    at async UserController.handleRequest (/app/src/controllers/user.ts:23:8)';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('UserController.handleRequest');
      expect(frame!.file).toBe('/app/src/controllers/user.ts');
      expect(frame!.line).toBe(23);
      expect(frame!.column).toBe(8);
      expect(frame!.language).toBe('javascript');
    });
  });

  describe('Chrome/Firefox format', () => {
    it('should parse Chrome frame with function name', () => {
      const line = 'handleClick@http://localhost:3000/static/js/main.js:123:45';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('handleClick');
      expect(frame!.file).toBe('http://localhost:3000/static/js/main.js');
      expect(frame!.line).toBe(123);
      expect(frame!.column).toBe(45);
      expect(frame!.language).toBe('javascript');
    });

    it('should parse Chrome frame with at prefix', () => {
      const line = '    at handleClick@http://localhost:3000/static/js/main.js:123:45';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('handleClick');
      expect(frame!.file).toBe('http://localhost:3000/static/js/main.js');
      expect(frame!.line).toBe(123);
      expect(frame!.column).toBe(45);
      expect(frame!.language).toBe('javascript');
    });

    it('should parse Chrome anonymous frame', () => {
      const line = '    @http://localhost:3000/static/js/vendor.js:50:30';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('<anonymous>');
      expect(frame!.file).toBe('http://localhost:3000/static/js/vendor.js');
      expect(frame!.line).toBe(50);
      expect(frame!.column).toBe(30);
      expect(frame!.language).toBe('javascript');
    });

    it('should parse Firefox frame with function name', () => {
      const line = 'handleClick@http://localhost:3000/static/js/main.js:123:45';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('handleClick');
      expect(frame!.file).toBe('http://localhost:3000/static/js/main.js');
      expect(frame!.line).toBe(123);
      expect(frame!.column).toBe(45);
      expect(frame!.language).toBe('javascript');
    });
  });

  describe('Python format', () => {
    it('should parse Python frame', () => {
      const line = '  File "/app/processor.py", line 15, in process_data';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('process_data');
      expect(frame!.file).toBe('/app/processor.py');
      expect(frame!.line).toBe(15);
      expect(frame!.column).toBeUndefined();
      expect(frame!.language).toBe('python');
    });

    it('should parse Python frame with module', () => {
      const line = '  File "/app/main.py", line 42, in main';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('main');
      expect(frame!.file).toBe('/app/main.py');
      expect(frame!.line).toBe(42);
      expect(frame!.language).toBe('python');
    });
  });

  describe('Java format', () => {
    it('should parse Java frame', () => {
      const line = '    at com.example.service.UserService.getUser(UserService.java:45)';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('com.example.service.UserService.getUser');
      expect(frame!.file).toBe('UserService.java');
      expect(frame!.line).toBe(45);
      expect(frame!.column).toBeUndefined();
      expect(frame!.language).toBe('java');
    });

    it('should parse Java native method frame', () => {
      const line = '    at org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:166)';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('org.apache.catalina.core.ApplicationFilterChain.doFilter');
      expect(frame!.file).toBe('ApplicationFilterChain.java');
      expect(frame!.line).toBe(166);
      expect(frame!.language).toBe('java');
    });
  });

  describe('Ruby format', () => {
    it('should parse Ruby frame', () => {
      const line = "app/controllers/users_controller.rb:15:in `show'";
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('show');
      expect(frame!.file).toBe('app/controllers/users_controller.rb');
      expect(frame!.line).toBe(15);
      expect(frame!.column).toBeUndefined();
      expect(frame!.language).toBe('ruby');
    });

    it('should parse Ruby middleware frame', () => {
      const line = "app/middleware/auth.rb:8:in `call'";
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('call');
      expect(frame!.file).toBe('app/middleware/auth.rb');
      expect(frame!.line).toBe(8);
      expect(frame!.language).toBe('ruby');
    });
  });

  describe('Go format', () => {
    it('should parse Go frame', () => {
      const line = '    /app/server.go:45 +0x1a5';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.function).toBe('<anonymous>');
      expect(frame!.file).toBe('/app/server.go');
      expect(frame!.line).toBe(45);
      expect(frame!.column).toBeUndefined();
      expect(frame!.language).toBe('go');
    });

    it('should parse Go standard library frame', () => {
      const line = '    /usr/local/go/src/net/http/server.go:2843 +0x316';
      const frame = parseStackFrame(line);

      expect(frame).not.toBeNull();
      expect(frame!.file).toBe('/usr/local/go/src/net/http/server.go');
      expect(frame!.line).toBe(2843);
      expect(frame!.language).toBe('go');
    });
  });

  describe('edge cases', () => {
    it('should return null for non-matching line', () => {
      const line = 'This is just a regular error message';
      const frame = parseStackFrame(line);
      expect(frame).toBeNull();
    });

    it('should return null for empty line', () => {
      const frame = parseStackFrame('');
      expect(frame).toBeNull();
    });

    it('should return null for error message lines', () => {
      const frame = parseStackFrame('TypeError: Cannot read property');
      expect(frame).toBeNull();
    });
  });
});

// ============================================================================
// parseStackTrace TESTS
// ============================================================================

describe('parseStackTrace', () => {
  it('should parse Node.js stack trace', () => {
    const frames = parseStackTrace(SAMPLE_STACK_TRACES.nodejs);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(f => f.language === 'javascript')).toBe(true);
  });

  it('should parse Python stack trace', () => {
    const frames = parseStackTrace(SAMPLE_STACK_TRACES.python);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(f => f.language === 'python')).toBe(true);
    expect(frames[0].function).toBe('main');
    expect(frames[1].function).toBe('process_data');
    expect(frames[2].function).toBe('transform');
  });

  it('should parse Java stack trace', () => {
    const frames = parseStackTrace(SAMPLE_STACK_TRACES.java);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(f => f.language === 'java')).toBe(true);
    expect(frames[0].function).toContain('UserService.getUser');
  });

  it('should parse Ruby stack trace', () => {
    const frames = parseStackTrace(SAMPLE_STACK_TRACES.ruby);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(f => f.language === 'ruby')).toBe(true);
    expect(frames[0].function).toBe('show');
  });

  it('should parse Go stack trace', () => {
    const frames = parseStackTrace(SAMPLE_STACK_TRACES.go);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(f => f.language === 'go')).toBe(true);
  });

  it('should return empty array for empty input', () => {
    const frames = parseStackTrace('');
    expect(frames).toEqual([]);
  });

  it('should return empty array for non-stack-trace text', () => {
    const frames = parseStackTrace('Just some regular text\nwith multiple lines\nbut no stack frames');
    expect(frames).toEqual([]);
  });
});

// ============================================================================
// detectStackTraceLanguage TESTS
// ============================================================================

describe('detectStackTraceLanguage', () => {
  it('should detect Node.js stack trace', () => {
    const language = detectStackTraceLanguage(SAMPLE_STACK_TRACES.nodejs);
    expect(language).toBe('javascript');
  });

  it('should detect Chrome stack trace', () => {
    const language = detectStackTraceLanguage(SAMPLE_STACK_TRACES.chrome);
    expect(language).toBe('javascript');
  });

  it('should detect Firefox stack trace', () => {
    // Firefox format is same as Chrome (functionName@file:line:col)
    const language = detectStackTraceLanguage(SAMPLE_STACK_TRACES.firefox);
    expect(language).toBe('javascript');
  });

  it('should detect Python stack trace', () => {
    const language = detectStackTraceLanguage(SAMPLE_STACK_TRACES.python);
    expect(language).toBe('python');
  });

  it('should detect Java stack trace', () => {
    const language = detectStackTraceLanguage(SAMPLE_STACK_TRACES.java);
    expect(language).toBe('java');
  });

  it('should detect Ruby stack trace', () => {
    const language = detectStackTraceLanguage(SAMPLE_STACK_TRACES.ruby);
    expect(language).toBe('ruby');
  });

  it('should detect Go stack trace', () => {
    const language = detectStackTraceLanguage(SAMPLE_STACK_TRACES.go);
    expect(language).toBe('go');
  });

  it('should return unknown for unrecognized format', () => {
    const language = detectStackTraceLanguage('Some random text that is not a stack trace');
    expect(language).toBe('unknown');
  });
});

// ============================================================================
// STACK_PATTERNS TESTS
// ============================================================================

describe('STACK_PATTERNS', () => {
  it('should have all expected patterns defined', () => {
    expect(STACK_PATTERNS).toHaveProperty('nodejs');
    expect(STACK_PATTERNS).toHaveProperty('chrome');
    expect(STACK_PATTERNS).toHaveProperty('python');
    expect(STACK_PATTERNS).toHaveProperty('java');
    expect(STACK_PATTERNS).toHaveProperty('ruby');
    expect(STACK_PATTERNS).toHaveProperty('go');
  });

  it('should have named capture groups in all patterns', () => {
    for (const [, pattern] of Object.entries(STACK_PATTERNS)) {
      const source = pattern.source;
      expect(source).toContain('?<file>');
      expect(source).toContain('?<line>');
      // func and col are optional in some formats
    }
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Stack trace parsing integration', () => {
  it('should handle mixed content with stack trace embedded', () => {
    const mixedContent = `
Application started
Processing request...
Error occurred!
${SAMPLE_STACK_TRACES.nodejs}
Application shutting down
`;
    const frames = parseStackTrace(mixedContent);
    expect(frames.length).toBeGreaterThan(0);
  });

  it('should preserve frame order', () => {
    const frames = parseStackTrace(SAMPLE_STACK_TRACES.python);

    // Python frames should be in the order they appear
    expect(frames[0].file).toContain('main.py');
    expect(frames[1].file).toContain('processor.py');
    expect(frames[2].file).toContain('utils.py');
  });

  it('should handle large stack traces efficiently', () => {
    // Create a large stack trace (100 frames)
    const largeTrace = Array(100)
      .fill('    at SomeFunction (/app/src/file.ts:10:5)')
      .join('\n');

    const start = Date.now();
    const frames = parseStackTrace(largeTrace);
    const elapsed = Date.now() - start;

    expect(frames.length).toBe(100);
    expect(elapsed).toBeLessThan(100); // Should complete in under 100ms
  });
});
