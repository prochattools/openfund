'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLedger } from '@/context/ledger-context';
import { FinanceAppFrame } from '@/ui/FinanceAppFrame';
import {
  buildDashboardSummary,
  calculateMoneyFlowHeight,
  formatDashboardEuro,
  formatDashboardImportDate,
  isDashboardPeriodReady,
  type DashboardBreakdownItem,
} from '@/helpers/dashboard-summary';
import { fetchImportBatches, getImportBatchDownloadUrl, type ImportBatchSummary } from '@/libs/api';

type MoneyTone = 'neutral' | 'income' | 'expense' | 'review';

const formatEuro = formatDashboardEuro;
const formatImportDate = formatDashboardImportDate;

function PageHeader({ monthLabel, reportHref }: { monthLabel: string; reportHref: string }) {
  return (
    <header className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(87,67,45,0.08)] md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-medium text-[#7d6d5a]">Dashboard</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#251f1a] md:text-4xl">Financieel overzicht</h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm font-semibold capitalize text-[#574b3f]">{monthLabel}</span>
        <Link className="rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] px-5 py-3 text-sm font-semibold text-[#574b3f]" href={reportHref}>
          Maandrapport
        </Link>
        <Link className="rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2] shadow-[0_14px_35px_rgba(31,95,74,0.22)]" href="/ledger#importeren">
          ING-export importeren
        </Link>
      </div>
    </header>
  );
}

function KpiCard({ label, value, helper, tone = 'neutral' }: { label: string; value: string; helper: string; tone?: MoneyTone }) {
  const toneClass =
    tone === 'income'
      ? 'bg-[#e7f0e7] text-[#1f5f4a]'
      : tone === 'expense'
        ? 'bg-[#f4e7df] text-[#914f35]'
        : tone === 'review'
          ? 'bg-[#f5e9c8] text-[#7a5512]'
          : 'bg-[#eee8df] text-[#574b3f]';

  return (
    <article className="rounded-[1.75rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_18px_55px_rgba(87,67,45,0.07)]">
      <div className={`mb-5 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{label}</div>
      <p className="text-3xl font-semibold tracking-[-0.05em] text-[#251f1a] md:text-4xl">{value}</p>
      <p className="mt-2 text-sm text-[#7d6d5a]">{helper}</p>
    </article>
  );
}

function BreakdownCard({ title, items, emptyText }: { title: string; items: DashboardBreakdownItem[]; emptyText: string }) {
  return (
    <article className="rounded-[1.75rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_18px_55px_rgba(87,67,45,0.07)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#251f1a]">{title}</h3>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7965]">Top 5</span>
      </div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-[#4a4036]">{item.label}</span>
                <span className="text-[#7d6d5a]">{formatEuro(item.amount)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#eee7dc]">
                <div className="h-full rounded-full bg-[#1f5f4a]" style={{ width: `${Math.max(item.share * 100, 4)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-[#f5f1ea] p-4 text-sm text-[#7d6d5a]">{emptyText}</p>
      )}
    </article>
  );
}

function MoneyFlowChart({ income, expenses }: { income: number; expenses: number }) {
  const max = Math.max(income, expenses, 1);
  const incomeHeight = calculateMoneyFlowHeight(income, max);
  const expenseHeight = calculateMoneyFlowHeight(expenses, max);

  return (
    <article className="rounded-[1.75rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_18px_55px_rgba(87,67,45,0.07)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em]">Geldstroom</h3>
          <p className="mt-1 text-sm text-[#7d6d5a]">Inkomsten tegenover uitgaven.</p>
        </div>
      </div>
      <div className="flex h-56 items-end justify-center gap-12 rounded-3xl bg-[#f5f1ea] px-8 pb-6 pt-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 rounded-t-[1.5rem] bg-[#1f5f4a]" style={{ height: incomeHeight }} />
          <div className="text-center">
            <p className="text-sm font-semibold">Inkomsten</p>
            <p className="text-xs text-[#7d6d5a]">{formatEuro(income)}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 rounded-t-[1.5rem] bg-[#b66a48]" style={{ height: expenseHeight }} />
          <div className="text-center">
            <p className="text-sm font-semibold">Uitgaven</p>
            <p className="text-xs text-[#7d6d5a]">{formatEuro(expenses)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function LatestImportCard({ latestImport }: { latestImport: ImportBatchSummary | null }) {
  return (
    <article className="rounded-[1.75rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_18px_55px_rgba(87,67,45,0.07)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em]">Laatste ING-import</h3>
          <p className="mt-1 text-sm text-[#7d6d5a]">Bronbestand en importresultaat.</p>
        </div>
        <Link href="/settings" className="rounded-full bg-[#f5f1ea] px-3 py-1 text-xs font-semibold text-[#7d6d5a]">Alle imports</Link>
      </div>
      {latestImport ? (
        <div className="space-y-3">
          <div className="rounded-[1.5rem] bg-[#f5f1ea] p-4">
            <p className="font-semibold text-[#251f1a]">{latestImport.filename}</p>
            <p className="mt-1 text-xs text-[#7d6d5a]">{formatImportDate(latestImport.completedAt ?? latestImport.startedAt)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-[#edf5ec] p-3 text-[#1f5f4a]"><strong>{latestImport.importedRows}</strong><br />nieuw</div>
            <div className="rounded-2xl bg-[#f5f1ea] p-3 text-[#6f6253]"><strong>{latestImport.duplicateRows}</strong><br />dubbel</div>
            <div className="rounded-2xl bg-[#f5f1ea] p-3 text-[#6f6253]"><strong>{latestImport.autoCategorizedRows}</strong><br />automatisch</div>
            <div className="rounded-2xl bg-[#fff7df] p-3 text-[#7a5512]"><strong>{latestImport.reviewRows}</strong><br />te beoordelen</div>
          </div>
          {latestImport.hasOriginalFile ? (
            <a href={getImportBatchDownloadUrl(latestImport.id)} className="block rounded-2xl bg-[#1f5f4a] px-4 py-3 text-center text-sm font-semibold text-[#fbf8f2]">Download origineel</a>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl bg-[#f5f1ea] p-4 text-sm text-[#7d6d5a]">Nog geen importgeschiedenis gevonden.</p>
      )}
    </article>
  );
}

function ImportStatusCard({ total, reviewCount, autoCategorized }: { total: number; reviewCount: number; autoCategorized: number }) {
  const ready = isDashboardPeriodReady(total, reviewCount);

  return (
    <article className="rounded-[1.75rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_18px_55px_rgba(87,67,45,0.07)]">
      <h3 className="text-lg font-semibold tracking-[-0.03em]">Maandstatus</h3>
      <div className="mt-5 rounded-[1.5rem] bg-[#edf5ec] p-5">
        <p className="text-sm font-semibold text-[#1f5f4a]">Transacties geladen</p>
        <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{total}</p>
        <p className="mt-1 text-sm text-[#4d6c57]">transacties in het overzicht</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#f5f1ea] p-4">
          <p className="text-2xl font-semibold">{autoCategorized}</p>
          <p className="text-sm text-[#7d6d5a]">automatisch</p>
        </div>
        <div className="rounded-2xl bg-[#f5e9c8] p-4">
          <p className="text-2xl font-semibold">{reviewCount}</p>
          <p className="text-sm text-[#7a5512]">nog te beoordelen</p>
        </div>
      </div>
      <div className={`mt-4 rounded-2xl p-4 text-sm ${ready ? 'bg-[#edf5ec] text-[#1f5f4a]' : 'bg-[#fff7df] text-[#7a5512]'}`}>
        {ready ? 'Deze maand is klaar voor controle in Rapporten.' : 'Rond eerst de open transacties af voordat je de maand gebruikt voor rapportage.'}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/review" className="rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] px-4 py-3 text-center text-sm font-semibold text-[#574b3f]">Beoordelen</Link>
        <Link href="/reports" className="rounded-2xl bg-[#1f5f4a] px-4 py-3 text-center text-sm font-semibold text-[#fbf8f2]">Rapport openen</Link>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <section className="rounded-[2rem] border border-dashed border-[#d7cabb] bg-[#fbf8f2] p-8 text-center shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a7965]">Nog geen transacties</p>
      <h3 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.05em] text-[#251f1a]">Importeer de eerste ING maandexport om het dashboard te vullen.</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6f6253]">De ING-export blijft de bron van waarheid. Dubbele transacties worden automatisch genegeerd en onbekende transacties komen in de beoordelingsrij.</p>
      <Link href="/ledger#importeren" className="mt-6 inline-flex rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2]">
        ING-export importeren
      </Link>
    </section>
  );
}

export default function FinanceDashboard() {
  const { transactions, summary } = useLedger();
  const [latestImport, setLatestImport] = useState<ImportBatchSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchImportBatches(1)
      .then((batches) => {
        if (!cancelled) {
          setLatestImport(batches[0] ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLatestImport(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dashboard = useMemo(() => buildDashboardSummary(transactions), [transactions]);

  return (
    <FinanceAppFrame reviewCount={summary.reviewCount} activeHref="/" showWorkflowHint>
      <PageHeader monthLabel={dashboard.monthLabel} reportHref={dashboard.reportHref} />
      {transactions.length ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Inkomsten" value={formatEuro(dashboard.income)} helper={`Ontvangen in ${dashboard.monthLabel}`} tone="income" />
            <KpiCard label="Uitgaven" value={formatEuro(dashboard.expenses)} helper={`Besteed in ${dashboard.monthLabel}`} tone="expense" />
            <KpiCard label="Saldo verandering" value={formatEuro(dashboard.net)} helper="Inkomsten min uitgaven" />
            <KpiCard label="Nog te beoordelen" value={`${dashboard.reviewCount}`} helper="Geen volledige historische match" tone="review" />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <MoneyFlowChart income={dashboard.income} expenses={dashboard.expenses} />
            <ImportStatusCard total={dashboard.monthTransactions.length} reviewCount={dashboard.reviewCount} autoCategorized={dashboard.autoCategorized} />
          </section>

          <section className="mt-6">
            <LatestImportCard latestImport={latestImport} />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <BreakdownCard title="Inkomsten per categorie" items={dashboard.incomeBreakdown} emptyText="Geen inkomsten gevonden voor deze maand." />
            <BreakdownCard title="Uitgaven per categorie" items={dashboard.expenseBreakdown} emptyText="Geen uitgaven gevonden voor deze maand." />
          </section>
        </>
      ) : (
        <EmptyState />
      )}
    </FinanceAppFrame>
  );
}
