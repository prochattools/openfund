'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { useLedger, type LedgerTransaction } from '@/context/ledger-context';

const euroFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const monthFormatter = new Intl.DateTimeFormat('nl-NL', {
  month: 'long',
  year: 'numeric',
});

type MoneyTone = 'neutral' | 'income' | 'expense' | 'review';

type BreakdownItem = {
  label: string;
  amount: number;
  share: number;
};

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Importeren', href: '/ledger#importeren' },
  { label: 'Te beoordelen', href: '/review' },
  { label: 'Transacties', href: '/ledger#transacties' },
  { label: 'Rapporten', href: '/reports' },
  { label: 'Instellingen', href: '/settings' },
];

const formatEuro = (value: number) => euroFormatter.format(value);

const getTransactionDate = (transaction: LedgerTransaction) => {
  const date = new Date(transaction.date);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const getLatestMonthKey = (transactions: LedgerTransaction[]) => {
  if (!transactions.length) {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  const latest = transactions.reduce((current, transaction) => {
    const nextDate = getTransactionDate(transaction);
    return nextDate.getTime() > current.getTime() ? nextDate : current;
  }, getTransactionDate(transactions[0]!));

  return `${latest.getUTCFullYear()}-${String(latest.getUTCMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return monthFormatter.format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)));
};

const getCategoryLabel = (transaction: LedgerTransaction) => {
  return (
    transaction.mainCategoryName ??
    transaction.categoryName ??
    transaction.suggestedMainCategoryName ??
    transaction.suggestedSubCategoryName ??
    'Nog te beoordelen'
  );
};

const buildBreakdown = (transactions: LedgerTransaction[], direction: 'income' | 'expense'): BreakdownItem[] => {
  const filtered = transactions.filter((transaction) =>
    direction === 'income' ? transaction.amount > 0 : transaction.amount < 0,
  );
  const totals = new Map<string, number>();

  filtered.forEach((transaction) => {
    const label = getCategoryLabel(transaction);
    const amount = Math.abs(transaction.amount);
    totals.set(label, (totals.get(label) ?? 0) + amount);
  });

  const total = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);

  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
};

function AppFrame({ children, reviewCount }: { children: ReactNode; reviewCount: number }) {
  return (
    <main className="min-h-screen bg-[#f5f1ea] text-[#251f1a]">
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <aside className="hidden w-64 shrink-0 rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(87,67,45,0.08)] lg:block">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a7965]">Yeshua Academy</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#251f1a]">Finance</h1>
          </div>
          <nav className="space-y-2">
            {navItems.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  index === 0
                    ? 'bg-[#1f5f4a] text-[#fbf8f2] shadow-[0_10px_30px_rgba(31,95,74,0.18)]'
                    : 'text-[#6f6253] hover:bg-[#efe7db] hover:text-[#251f1a]'
                }`}
              >
                <span>{item.label}</span>
                {item.label === 'Te beoordelen' && reviewCount > 0 ? (
                  <span className="rounded-full bg-[#e6b85c] px-2 py-0.5 text-xs text-[#35240a]">{reviewCount}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="mt-8 rounded-3xl bg-[#efe7db] p-4 text-sm text-[#5f5347]">
            <p className="font-semibold text-[#251f1a]">Rustige workflow</p>
            <p className="mt-1">Importeer de ING-export, beoordeel wat overblijft en controleer de maand.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}

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

function BreakdownCard({ title, items, emptyText }: { title: string; items: BreakdownItem[]; emptyText: string }) {
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
  const incomeHeight = Math.max((income / max) * 170, 16);
  const expenseHeight = Math.max((expenses / max) * 170, 16);

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

function ImportStatusCard({ total, reviewCount, autoCategorized }: { total: number; reviewCount: number; autoCategorized: number }) {
  const ready = total > 0 && reviewCount === 0;

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

  const dashboard = useMemo(() => {
    const monthKey = getLatestMonthKey(transactions);
    const monthTransactions = transactions.filter((transaction) => {
      const date = getTransactionDate(transaction);
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      return key === monthKey;
    });

    const income = monthTransactions
      .filter((transaction) => transaction.amount > 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = monthTransactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const reviewCount = monthTransactions.filter((transaction) => transaction.needsManualCategory).length;
    const autoCategorized = monthTransactions.filter((transaction) => transaction.autoCategorized).length;

    return {
      monthKey,
      monthLabel: getMonthLabel(monthKey),
      monthTransactions,
      income,
      expenses,
      net: income - expenses,
      reviewCount,
      autoCategorized,
      incomeBreakdown: buildBreakdown(monthTransactions, 'income'),
      expenseBreakdown: buildBreakdown(monthTransactions, 'expense'),
      reportHref: `/reports?year=${monthKey.slice(0, 4)}&month=${Number(monthKey.slice(5, 7))}`,
    };
  }, [transactions]);

  return (
    <AppFrame reviewCount={summary.reviewCount}>
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

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <BreakdownCard title="Inkomsten per categorie" items={dashboard.incomeBreakdown} emptyText="Geen inkomsten gevonden voor deze maand." />
            <BreakdownCard title="Uitgaven per categorie" items={dashboard.expenseBreakdown} emptyText="Geen uitgaven gevonden voor deze maand." />
          </section>
        </>
      ) : (
        <EmptyState />
      )}
    </AppFrame>
  );
}
