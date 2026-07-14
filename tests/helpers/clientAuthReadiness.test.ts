import { describe, expect, it } from 'vitest';
import { isFinanceSessionReady } from '../../src/helpers/client-auth-readiness';

describe('finance client auth readiness', () => {
  it('waits for Clerk to finish loading and establish a signed-in session', () => {
    expect(isFinanceSessionReady({ authEnabled: true, isLoaded: false, isSignedIn: false })).toBe(false);
    expect(isFinanceSessionReady({ authEnabled: true, isLoaded: true, isSignedIn: false })).toBe(false);
    expect(isFinanceSessionReady({ authEnabled: true, isLoaded: true, isSignedIn: true })).toBe(true);
  });

  it('keeps local development data loading available when auth is disabled', () => {
    expect(isFinanceSessionReady({ authEnabled: false, isLoaded: true, isSignedIn: false })).toBe(true);
  });
});
