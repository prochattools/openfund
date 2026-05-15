import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const loadSitemap = async (appUrl?: string) => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  if (appUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = appUrl;
  }
  const mod = await import('../../src/app/sitemap');
  return mod.default();
};

afterEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

describe('sitemap', () => {
  it('uses the finance domain fallback when no app URL is configured', async () => {
    const entries = await loadSitemap();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      url: 'https://finance.yeshua.academy',
      changeFrequency: 'yearly',
      priority: 1,
    });
    expect(entries[0]?.lastModified).toBeInstanceOf(Date);
  });

  it('uses the configured public app URL when present', async () => {
    const entries = await loadSitemap('https://administratie.yeshua.academy');

    expect(entries[0]?.url).toBe('https://administratie.yeshua.academy');
  });
});
