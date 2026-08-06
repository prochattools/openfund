'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchReportSummary, sendMonthlyReport, fetchEmailRecipients } from '@/libs/api';
import { useLedger } from '@/context/ledger-context';
import { FinanceAppFrame } from '@/ui/FinanceAppFrame';
import {
  buildLocalReportSummary,
  formatEuroMinor,
  getPeriodReviewCount,
  getReportBreakdownShare,
  getReportBreakdownTotal,
  getReportPeriodLabel,
  getReportYears,
  normalizeInitialReportPeriod,
  type ReportBreakdownItem,
  type ReportSummary,
} from '@/helpers/report-summary';

const monthFormatter = new Intl.DateTimeFormat('nl-NL', {
  month: 'long',
  year: 'numeric',
});

const formatEuro = (minor: number) => formatEuroMinor(minor);

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="rounded-[1.75rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_18px_55px_rgba(87,67,45,0.07)]">
      <p className="text-sm font-semibold text-[#7d6d5a]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{value}</p>
      <p className="mt-2 text-sm text-[#7d6d5a]">{helper}</p>
    </article>
  );
}

function BreakdownList({ title, items }: { title: string; items: ReportBreakdownItem[] }) {
  const total = getReportBreakdownTotal(items);

  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
        <span className="rounded-full bg-[#f5f1ea] px-3 py-1 text-xs font-semibold text-[#7d6d5a]">{items.length} categorieën</span>
      </div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((item) => {
            const share = getReportBreakdownShare(item, total);
            return (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                  <span className="font-semibold text-[#4a4036]">{item.label}</span>
                  <span className="text-[#7d6d5a]">{formatEuro(item.amountMinor)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eee7dc]">
                  <div className="h-full rounded-full bg-[#1f5f4a]" style={{ width: `${Math.max(share * 100, 3)}%` }} />
                </div>
                <p className="mt-1 text-xs text-[#8a7965]">{item.transactionCount} transacties</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl bg-[#f5f1ea] p-5 text-sm text-[#6f6253]">Geen gegevens gevonden voor deze periode.</p>
      )}
    </section>
  );
}

function ReportExplanation({ summary }: { summary: ReportSummary }) {
  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <p className="text-sm font-medium text-[#7d6d5a]">Jaarverslagtekst</p>
      <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Eenvoudige ANBI-samenvatting</h3>
      <div className="mt-5 rounded-[1.5rem] bg-[#f5f1ea] p-5 text-sm leading-7 text-[#574b3f]">
        <p>
          In deze periode begon Yeshua Academy met een saldo van {formatEuro(summary.openingBalanceMinor)}. Er werd {formatEuro(summary.incomeMinor)} ontvangen en {formatEuro(summary.expenseMinor)} besteed aan activiteiten, ondersteuning en administratie.
          Het resultaat over deze periode is {formatEuro(summary.netMinor)} en de eindbalans is {formatEuro(summary.closingBalanceMinor)}.
        </p>
        <p className="mt-3">
          Deze tekst is bedoeld als eenvoudige basis voor interne controle en publieke financiële verantwoording. Controleer de categorieën en toelichting altijd handmatig voordat je dit publiceert.
        </p>
      </div>
    </section>
  );
}

type MonthReadiness = {
  coverageStatus: string | null;
  closeEligible: boolean;
  unresolvedCount: number;
  balanceDifferenceMinor: string;
  categoryIncomeDifferenceMinor: string;
  categoryExpenseDifferenceMinor: string;
  periodCloseStatus: string | null;
};

function ReadinessBlocker({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-[#c62828]">
      <span aria-hidden>✗</span>
      <span>{label}</span>
    </li>
  );
}

function ReadinessOk({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-[#2e7d32]">
      <span aria-hidden>✓</span>
      <span>{label}</span>
    </li>
  );
}

function MonthlySendPanel({ year, month }: { year: number; month: number | null }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [readiness, setReadiness] = useState<MonthReadiness | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    setReadinessLoading(true);
    setReadiness(null);

    // Load accounting audit data and recipient count in parallel
    Promise.all([
      fetch('/api/accounting/audit', { credentials: 'include', cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null),
      fetchEmailRecipients(),
    ])
      .then(([auditData, recipients]) => {
        if (cancelled) return;
        setRecipientCount(recipients.filter((r) => r.isActive).length);
        if (auditData && Array.isArray(auditData.months)) {
          const monthData = (auditData.months as Array<{
            year: number;
            month: number;
            coverageStatus: string;
            closeEligible: boolean;
            unresolvedTransactionCount: number;
            balanceDifferenceMinor: string;
            categoryIncomeDifferenceMinor: string;
            categoryExpenseDifferenceMinor: string;
          }>).find((m) => m.year === year && m.month === month);

          // Find the period close status from closed periods
          // Use the accounting close status to determine periodCloseStatus
          const isClosed = auditData.closedMonths
            ? Array.isArray(auditData.closedMonths) && auditData.closedMonths.includes(
                `${year}-${String(month).padStart(2, '0')}`,
              )
            : false;

          if (monthData) {
            setReadiness({
              coverageStatus: monthData.coverageStatus ?? null,
              closeEligible: monthData.closeEligible,
              unresolvedCount: monthData.unresolvedTransactionCount,
              balanceDifferenceMinor: monthData.balanceDifferenceMinor,
              categoryIncomeDifferenceMinor: monthData.categoryIncomeDifferenceMinor,
              categoryExpenseDifferenceMinor: monthData.categoryExpenseDifferenceMinor,
              periodCloseStatus: isClosed ? 'CLOSED' : null,
            });
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadiness(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReadinessLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  if (!month) return null;

  const isClosed = readiness?.periodCloseStatus === 'CLOSED';
  const hasRecipients = recipientCount !== null && recipientCount > 0;
  const hasUnresolved = readiness !== null && readiness.unresolvedCount > 0;
  const canSend = isClosed && hasRecipients && !hasUnresolved;

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeMessage, setCloseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canClose = readiness?.closeEligible && !isClosed;

  const handleClose = async () => {
    if (!canClose || !readiness) return;
    setCloseLoading(true);
    setCloseMessage(null);
    try {
      // Get statement period and close control hash
      const previewResponse = await fetch(
        `/api/reconciliation/statement-periods/close-preview?year=${year}&month=${month}`,
        { credentials: 'include', cache: 'no-store' },
      );

      if (!previewResponse.ok) {
        throw new Error('Afschriftperiode kon niet worden geladen.');
      }

      const previewData = await previewResponse.json() as {
        statementPeriod?: { id: string };
        ledger?: { id: string };
        closeControlHash?: string;
      };

      if (!previewData.statementPeriod?.id || !previewData.ledger?.id) {
        throw new Error('Afschriftperiode of grootboek niet gevonden.');
      }

      // Close the period using the strict period close endpoint
      const closeResponse = await fetch(
        `/api/reconciliation/statement-periods/${previewData.statementPeriod.id}/close`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ledgerId: previewData.ledger.id,
            expectedCloseControlHash: previewData.closeControlHash || null,
            confirmed: true,
          }),
        },
      );

      if (!closeResponse.ok) {
        const error = await closeResponse.json() as { error?: string };
        throw new Error(error.error || 'Periode kon niet worden gesloten.');
      }

      setCloseMessage({
        type: 'success',
        text: 'Periode is afgesloten. Ververs de pagina om het rapport te versturen.',
      });
      setShowCloseConfirm(false);

      // Refresh readiness after a short delay
      setTimeout(() => {
        setReadinessLoading(true);
      }, 1000);
    } catch (err: unknown) {
      setCloseMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Periode kon niet worden gesloten.',
      });
    } finally {
      setCloseLoading(false);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await sendMonthlyReport({
        year,
        month,
        confirmed: true,
      });
      setMessage({
        type: 'success',
        text: `Rapport verstuurd naar ${result.recipientCount} ontvangers.`,
      });
      setShowConfirm(false);
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Rapport verzenden mislukt.',
      });
    } finally {
      setLoading(false);
    }
  };

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-[-0.04em]">Maandrapport</h3>
          <p className="mt-2 text-sm text-[#7d6d5a]">
            Stuur dit maandrapport naar actieve e-mailontvangers.
          </p>
        </div>
        <Link
          href="/settings"
          className="shrink-0 rounded-full bg-[#1f5f4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#184838]"
        >
          Ontvangers beheren
        </Link>
      </div>

      {/* Readiness diagnostics */}
      {readinessLoading && (
        <div className="mt-4 rounded-lg bg-[#f5f1ea] p-3 text-sm text-[#6f6253]">
          Gereedheid controleren…
        </div>
      )}

      {!readinessLoading && (
        <div className="mt-4 rounded-lg bg-[#f5f1ea] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7d6d5a]">
            Gereedheid {yearMonth}
          </p>
          <ul className="space-y-1">
            {readiness?.coverageStatus === 'COMPLETE'
              ? <ReadinessOk label="Bankdekking volledig" />
              : <ReadinessBlocker label="Bankdekking niet volledig" />}

            {readiness?.balanceDifferenceMinor === '0'
              ? <ReadinessOk label="Banksaldo klopt" />
              : <ReadinessBlocker label={`Bankverschil: ${readiness?.balanceDifferenceMinor ?? '—'} cent`} />}

            {readiness?.categoryIncomeDifferenceMinor === '0' && readiness?.categoryExpenseDifferenceMinor === '0'
              ? <ReadinessOk label="Categorietotalen kloppen" />
              : <ReadinessBlocker label="Categorie-verschillen aanwezig" />}

            {hasUnresolved
              ? <ReadinessBlocker label={`${readiness!.unresolvedCount} ongeboekte transacties`} />
              : <ReadinessOk label="Alle transacties geboekt" />}

            {isClosed
              ? <ReadinessOk label="Periode is afgesloten (CLOSED)" />
              : <ReadinessBlocker label="Periode is niet afgesloten — sluit de maand eerst af" />}

            {hasRecipients
              ? <ReadinessOk label={`${recipientCount} actieve ontvangers`} />
              : <ReadinessBlocker label="Geen actieve e-mailontvangers — voeg ontvangers toe in Instellingen" />}
          </ul>
        </div>
      )}

      {/* Close message */}
      {closeMessage && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            closeMessage.type === 'success'
              ? 'border border-[#4caf50] bg-[#f1f8f4] text-[#2e7d32]'
              : 'border border-[#f44336] bg-[#ffebee] text-[#c62828]'
          }`}
        >
          {closeMessage.text}
        </div>
      )}

      {/* Close action (only when eligible and not yet closed) */}
      {canClose && (
        <div className="mt-4">
          {showCloseConfirm ? (
            <div className="rounded-lg border border-[#e6b85c] bg-[#fff7df] p-4">
              <p className="text-sm text-[#7a5512]">
                Weet je zeker dat je maand {yearMonth} wilt afsluiten? Dit kan niet ongedaan gemaakt worden zonder beheerderinvoer.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleClose}
                  disabled={closeLoading}
                  className="rounded-full bg-[#1f5f4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#184838] disabled:opacity-50"
                >
                  {closeLoading ? 'Afsluiten…' : 'Bevestigen'}
                </button>
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  disabled={closeLoading}
                  className="rounded-full border border-[#7a5512] px-4 py-2 text-sm font-semibold text-[#7a5512] hover:bg-[#f5f1ea] disabled:opacity-50"
                >
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCloseConfirm(true)}
              disabled={closeLoading}
              className="rounded-full bg-[#1f5f4a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#184838] disabled:opacity-50"
            >
              Maand afsluiten
            </button>
          )}
        </div>
      )}

      {/* Result message */}
      {message && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.type === 'success'
              ? 'border border-[#4caf50] bg-[#f1f8f4] text-[#2e7d32]'
              : 'border border-[#f44336] bg-[#ffebee] text-[#c62828]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Send action */}
      <div className="mt-4">
        {showConfirm ? (
          <div className="rounded-lg border border-[#e6b85c] bg-[#fff7df] p-4">
            <p className="text-sm text-[#7a5512]">
              Weet je zeker dat je het maandrapport voor {yearMonth} wilt versturen naar {recipientCount ?? 0}{' '}
              {recipientCount === 1 ? 'ontvanger' : 'ontvangers'}?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSend}
                disabled={loading || !canSend}
                className="rounded-full bg-[#1f5f4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#184838] disabled:opacity-50"
              >
                {loading ? 'Verzenden…' : 'Bevestigen en versturen'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="rounded-full border border-[#7a5512] px-4 py-2 text-sm font-semibold text-[#7a5512] hover:bg-[#f5f1ea] disabled:opacity-50"
              >
                Annuleren
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!canSend || loading}
            title={
              !canSend
                ? 'Los de openstaande punten boven op voordat je het rapport verstuurt'
                : undefined
            }
            className="rounded-full bg-[#1f5f4a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#184838] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Verstuur maandrapport
          </button>
        )}
      </div>
    </section>
  );
}

export default function FinanceReportsPage({ initialYear, initialMonth }: { initialYear?: number; initialMonth?: number | null }) {
  const { transactions, summary: ledgerSummary } = useLedger();
  const years = useMemo(() => getReportYears(transactions), [transactions]);
  const initialPeriod = useMemo(
    () => normalizeInitialReportPeriod(years, initialYear, initialMonth),
    [initialMonth, initialYear, years],
  );
  const [year, setYear] = useState(initialPeriod.year);
  const [month, setMonth] = useState<number | null>(initialPeriod.month);
  const [remoteSummary, setRemoteSummary] = useState<ReportSummary | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'fallback'>('idle');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchReportSummary({ year, month })
      .then((data) => {
        if (!cancelled) {
          setRemoteSummary(data as ReportSummary);
          setStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteSummary(null);
          setStatus('fallback');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const localSummary = useMemo(() => buildLocalReportSummary(transactions, year, month), [transactions, year, month]);
  const periodReviewCount = useMemo(() => getPeriodReviewCount(transactions, year, month), [transactions, year, month]);
  const report = remoteSummary ?? localSummary;
  const periodLabel = getReportPeriodLabel(year, month, monthFormatter);

  return (
    <FinanceAppFrame reviewCount={ledgerSummary.reviewCount} activeHref="/reports">
      <header className="mb-6 rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-[#7d6d5a]">Rapporten</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">Maand- en jaaroverzicht</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6253]">Gebruik dit overzicht voor interne controle, maandupdates en de basis van de jaarlijkse ANBI-verantwoording.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm font-semibold outline-none focus:border-[#1f5f4a]">
              {years.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={month ?? 'year'} onChange={(event) => setMonth(event.target.value === 'year' ? null : Number(event.target.value))} className="rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm font-semibold outline-none focus:border-[#1f5f4a]">
              <option value="year">Hele jaar</option>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{monthFormatter.format(new Date(Date.UTC(year, value - 1, 1)))}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {status === 'fallback' ? (
          <div className="rounded-2xl border border-[#e6b85c] bg-[#fff7df] p-4 text-sm text-[#7a5512]">De rapport-API kon niet worden geladen. Het scherm gebruikt tijdelijk de lokaal geladen transacties.</div>
        ) : null}
        {status === 'loading' ? (
          <div className="rounded-2xl bg-[#efe7db] p-4 text-sm text-[#6f6253]">Rapport wordt geladen…</div>
        ) : null}
        {periodReviewCount > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-[#e6b85c] bg-[#fff7df] p-4 text-sm text-[#7a5512] md:flex-row md:items-center md:justify-between">
            <span>{periodReviewCount} transacties in deze periode hebben nog beoordeling nodig. Gebruik dit rapport pas na controle.</span>
            <Link href="/review" className="rounded-full bg-[#7a5512] px-4 py-2 text-center text-xs font-semibold text-[#fff7df]">Open beoordeling</Link>
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Beginbalans" value={formatEuro(report.openingBalanceMinor)} helper={periodLabel} />
          <SummaryCard label="Inkomsten" value={formatEuro(report.incomeMinor)} helper="Totaal ontvangen" />
          <SummaryCard label="Uitgaven" value={formatEuro(report.expenseMinor)} helper="Totaal besteed" />
          <SummaryCard label="Resultaat" value={formatEuro(report.netMinor)} helper="Inkomsten min uitgaven" />
          <SummaryCard label="Eindbalans" value={formatEuro(report.closingBalanceMinor)} helper={`${report.transactionCount} transacties`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <BreakdownList title="Inkomsten" items={report.incomeByCategory} />
          <BreakdownList title="Uitgaven" items={report.expensesByCategory} />
        </section>

        {month && <MonthlySendPanel year={year} month={month} />}

        <ReportExplanation summary={report} />
      </div>
    </FinanceAppFrame>
  );
}
