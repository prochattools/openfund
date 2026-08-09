/**
 * Verifies that:
 * 1. The email-recipients Next.js route bridges POST to the Express handler.
 * 2. FinanceReportsPage.canSend does NOT include allPeriodsAreClosed.
 * 3. The UI does not display the "close periods first" send blocker.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('email-recipients Next.js POST bridge', () => {
  it('defines a POST export in the Next.js route file', () => {
    const route = read('src/app/api/email-recipients/route.ts');
    expect(route).toContain('export async function POST');
  });

  it('bridges POST to upsertEmailRecipient', () => {
    const route = read('src/app/api/email-recipients/route.ts');
    expect(route).toContain('upsertEmailRecipient');
    expect(route).toContain('invokeExpressJsonHandler');
  });

  it('also preserves the GET export for listEmailRecipients', () => {
    const route = read('src/app/api/email-recipients/route.ts');
    expect(route).toContain('export async function GET');
    expect(route).toContain('listEmailRecipients');
  });
});

describe('FinanceReportsPage canSend — period close not required', () => {
  it('canSend does not include allPeriodsAreClosed', () => {
    const page = read('src/ui/FinanceReportsPage.tsx');
    // canSend must NOT AND with allPeriodsAreClosed
    const canSendLine = page.split('\n').find((l) => l.includes('const canSend ='));
    expect(canSendLine).toBeDefined();
    expect(canSendLine).not.toContain('allPeriodsAreClosed');
    // Must still require recipients and no unresolved
    expect(canSendLine).toContain('hasRecipients');
    expect(canSendLine).toContain('hasUnresolved');
  });

  it('does not show "sluit alle afschriftperioden" as a send prerequisite', () => {
    const page = read('src/ui/FinanceReportsPage.tsx');
    // The old hard blocker text must be gone
    expect(page).not.toContain('Sluit alle afschriftperioden hierboven af voordat je het maandrapport verstuurt');
  });

  it('shows period close as optional rather than a red blocker', () => {
    const page = read('src/ui/FinanceReportsPage.tsx');
    // When periods are not closed, renders ReadinessOk with optional wording
    expect(page).toContain('optioneel');
  });
});

describe('monthlySendReport route — period close removed', () => {
  it('does not import or reference statementPeriod or periodClose in the route', () => {
    const route = read('server/routes/monthlySendReport.ts');
    expect(route).not.toContain('statementPeriod');
    expect(route).not.toContain('periodClose.findFirst');
    expect(route).not.toContain('status !== \'CLOSED\'');
  });

  it('uses generateLiveMonthlyReportSnapshot instead of generateMonthlyReportSnapshot', () => {
    const route = read('server/routes/monthlySendReport.ts');
    expect(route).toContain('generateLiveMonthlyReportSnapshot');
    expect(route).not.toContain('generateMonthlyReportSnapshot(');
  });

  it('allows repeat sends by keying each dispatch to the fresh snapshot attempt', () => {
    const route = read('server/routes/monthlySendReport.ts');
    expect(route).toContain('reportSnapshotId: snapshotResult.snapshotId');
    expect(route).not.toContain('DUPLICATE_DISPATCH');
    expect(route).not.toContain('Dit rapport is al ingediend');
    expect(route).not.toContain('computeReportEvidenceHash');
  });

  it('uses the verified yeshua.academy sender and surfaces provider failures', () => {
    const route = read('server/routes/monthlySendReport.ts');
    expect(route).toContain("rapport@yeshua.academy");
    expect(route).not.toContain('rapport@yeshuaacademy.nl');
    expect(route).toContain("sendResult.status === 'FAILED'");
    expect(route).toContain('res.status(502)');
  });

  it('handles ReportSnapshotError with its own status code', () => {
    const route = read('server/routes/monthlySendReport.ts');
    expect(route).toContain('ReportSnapshotError');
    expect(route).toContain('err.statusCode');
  });
});
