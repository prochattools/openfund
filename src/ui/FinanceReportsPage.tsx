'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchReportSummary } from '@/libs/api';
import { useLedger } from '@/context/ledger-context';
import {
  buildLocalReportSummary,
  formatEuroMinor,
  getPeriodTransactions,
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

function AppFrame({ children, reviewCount }: { children: ReactNode; reviewCount: number }) {
  const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Importeren', href: '/ledger#importeren' },
    { label: 'Te beoordelen', href: '/review' },
    { label: 'Transacties', href: '/ledger#transacties' },
    { label: 'Rapporten', href: '/reports' },
    { label: 'Instellingen', href: '/settings' },
  ];

  return (
    <main className="min-h-screen bg-[#f5f1ea] text-[#251f1a]">
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <aside className="hidden w-64 shrink-0 rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(87,67,45,0.08)] lg:block">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a7965]">Yeshua Academy</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Finance</h1>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-[#6f6253] transition hover:bg-[#efe7db] hover:text-[#251f1a]">
                <span>{item.label}</span>
                {item.label === 'Te beoordelen' && reviewCount > 0 ? <span className="rounded-full bg-[#e6b85c] px-2 py-0.5 text-xs text-[#35240a]">{reviewCount}</span> : null}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}

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
  const total = items.reduce((sum, item) => sum + item.amountMinor, 0);

  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
        <span className="rounded-full bg-[#f5f1ea] px-3 py-1 text-xs font-semibold text-[#7d6d5a]">{items.length} categorieën</span>
      </div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((item) => {
            const share = total > 0 ? item.amountMinor / total : 0;
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
  const periodTransactions = useMemo(() => getPeriodTransactions(transactions, year, month), [transactions, year, month]);
  const periodReviewCount = periodTransactions.filter((transaction) => transaction.needsManualCategory).length;
  const report = remoteSummary ?? localSummary;
  const periodLabel = getReportPeriodLabel(year, month, monthFormatter);

  return (
    <AppFrame reviewCount={ledgerSummary.reviewCount}>
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

        <ReportExplanation summary={report} />
      </div>
    </AppFrame>
  );
}
