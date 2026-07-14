import { describe, expect, it } from 'vitest';
import { getSafeSignInRedirect } from '../../src/app/sign-in/[[...sign-in]]/sign-in-client';

describe('Clerk sign-in redirect safety', () => {
  it('keeps internal application paths', () => {
    expect(getSafeSignInRedirect('/review')).toBe('/review');
    expect(getSafeSignInRedirect('%2Freports%3Fyear%3D2026')).toBe('/reports?year=2026');
  });

  it('rejects external, protocol-relative, and malformed redirect targets', () => {
    expect(getSafeSignInRedirect('https://evil.example')).toBe('/ledger');
    expect(getSafeSignInRedirect('//evil.example/path')).toBe('/ledger');
    expect(getSafeSignInRedirect('%2F%2Fevil.example')).toBe('/ledger');
    expect(getSafeSignInRedirect('%E0%A4%A')).toBe('/ledger');
  });
});
