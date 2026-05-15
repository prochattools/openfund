import { describe, expect, it } from 'vitest';
import config from '../../src/config';

describe('application config', () => {
  it('uses the Yeshua Academy Finance product identity', () => {
    expect(config.appName).toBe('Yeshua Academy Finance');
    expect(config.domainName).toBe('finance.yeshua.academy');
    expect(config.appDescription).toContain('ING-import');
    expect(config.appDescription).toContain('rapportage');
  });

  it('uses Dutch finance e-mail defaults without secret material', () => {
    expect(config.resend.fromAdmin).toBe('Yeshua Academy Finance <info@yeshua.academy>');
    expect(config.resend.supportEmail).toBe('info@yeshua.academy');
    expect(config.resend.forwardRepliesTo).toBe('info@yeshua.academy');
    expect(config.resend.subjects?.monthlySummary).toBe('Financieel maandoverzicht Yeshua Academy');
  });

  it('uses the simplified light finance theme color', () => {
    expect(config.colors).toEqual({
      theme: 'light',
      main: '#1f5f4a',
    });
  });
});
