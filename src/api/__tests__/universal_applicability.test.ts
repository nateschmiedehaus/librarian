import { describe, it, expect } from 'vitest';
import { UniversalProtocolSelector } from '../universal_applicability.js';

describe('UniversalProtocolSelector', () => {
  it('requires zero-knowledge bootstrap when knowledge is missing', () => {
    const selector = new UniversalProtocolSelector();
    const protocol = selector.selectProtocol({
      role: 'developer',
      task: 'modify',
      projectState: 'active',
      knowledgeState: 'none',
    });

    expect(protocol.phase1).not.toBeNull();
    expect(protocol.phase2.patterns).toContain('pattern_codebase_onboarding');
  });

  it('skips bootstrapping when knowledge is strong', () => {
    const selector = new UniversalProtocolSelector();
    const protocol = selector.selectProtocol({
      role: 'developer',
      task: 'modify',
      projectState: 'active',
      knowledgeState: 'excellent',
    });

    expect(protocol.phase1).toBeNull();
  });

  it('wraps legacy projects with additional precautions', () => {
    const selector = new UniversalProtocolSelector();
    const protocol = selector.selectProtocol({
      role: 'maintainer',
      task: 'modify',
      projectState: 'legacy',
      knowledgeState: 'good',
    });

    expect(protocol.phase2.id.endsWith('_legacy')).toBe(true);
    expect(protocol.phase2.patterns).toContain('pattern_dependency_update');
    expect(protocol.phase2.precautions?.length ?? 0).toBeGreaterThan(0);
  });

  it('adds structural analysis for obfuscated projects', () => {
    const selector = new UniversalProtocolSelector();
    const protocol = selector.selectProtocol({
      role: 'learner',
      task: 'understand',
      projectState: 'obfuscated',
      knowledgeState: 'poor',
    });

    expect(protocol.phase2.id.endsWith('_structural')).toBe(true);
    expect(protocol.phase2.patterns).toContain('pattern_codebase_onboarding');
  });

  it('caps confidence requirements for high-risk roles', () => {
    const selector = new UniversalProtocolSelector();
    const protocol = selector.selectProtocol({
      role: 'security_analyst',
      task: 'secure',
      projectState: 'active',
      knowledgeState: 'excellent',
    });

    expect(protocol.confidenceRequirements).toBe(0.95);
  });

  it('adds notes for poor documentation quality', () => {
    const selector = new UniversalProtocolSelector();
    const protocol = selector.selectProtocol({
      role: 'developer',
      task: 'document',
      projectState: 'active',
      knowledgeState: 'poor',
    });

    expect(protocol.notes.some((note) => note.includes('Low documentation'))).toBe(true);
  });
});
