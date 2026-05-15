import { describe, expect, it } from 'vitest';
import { buildEmailHtml, buildSubject, escapeHtml } from '../../src/app/api/ledger/notify/emailHelpers';

describe('notify route helpers', () => {
  it('builds Dutch subjects for known finance summary contexts', () => {
    expect(buildSubject({ view: 'monthly', periodLabel: 'mei 2026', accountLabel: 'Betaalrekening' })).toBe('Financieel maandoverzicht mei 2026');
    expect(buildSubject({ view: 'cashflow', periodLabel: '2026' })).toBe('Financiële geldstroom 2026');
    expect(buildSubject({ view: 'dashboard', periodLabel: 'mei 2026' })).toBe('Financiële samenvatting mei 2026');
  });

  it('falls back to filename or default subject when context is missing', () => {
    expect(buildSubject(undefined, 'maandoverzicht.xlsx')).toBe('Financiële export: maandoverzicht.xlsx');
    expect(buildSubject()).toBe('Financiële samenvatting Yeshua Academy');
  });

  it('builds Dutch e-mail HTML with fallback body and closing', () => {
    const html = buildEmailHtml('', { view: 'monthly', periodLabel: 'mei 2026', accountLabel: 'Betaalrekening' });

    expect(html).toContain('Hierbij ontvang je het financiële maandoverzicht voor Betaalrekening over mei 2026.');
    expect(html).toContain('De financiële samenvatting staat klaar in Yeshua Academy Finance.');
    expect(html).toContain('Hartelijke groet');
    expect(html).toContain('Deze e-mail is verstuurd vanuit de interne financiële administratie.');
  });

  it('includes provided summary HTML in the e-mail body', () => {
    const html = buildEmailHtml('<strong>Inkomsten: € 100</strong>');

    expect(html).toContain('<strong>Inkomsten: € 100</strong>');
    expect(html).toContain('Hierbij ontvang je de financiële samenvatting van Yeshua Academy.');
  });

  it('escapes dynamic context labels while preserving provided summary HTML', () => {
    expect(escapeHtml('Yeshua & <Finance> "Admin"')).toBe('Yeshua &amp; &lt;Finance&gt; &quot;Admin&quot;');

    const html = buildEmailHtml('<strong>Veilige samenvatting</strong>', {
      view: 'monthly',
      periodLabel: 'mei <2026>',
      accountLabel: 'Betaalrekening & kas',
    });

    expect(html).toContain('Betaalrekening &amp; kas over mei &lt;2026&gt;');
    expect(html).toContain('<strong>Veilige samenvatting</strong>');
    expect(html).not.toContain('mei <2026>');
  });
});
