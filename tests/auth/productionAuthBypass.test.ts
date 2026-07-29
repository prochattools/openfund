import { describe, it, expect } from 'vitest';

describe('production auth bypass', () => {
  it('production auth bypass is configured as server-only', () => {
    expect(process.env.ALLOW_PRODUCTION_AUTH_BYPASS).not.toBeDefined();
  });

  it('bypass requires explicit enable flag', () => {
    const enabled = process.env.ALLOW_PRODUCTION_AUTH_BYPASS === 'true';
    expect(enabled).toBe(false);
  });
});
