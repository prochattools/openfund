'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { useLedger, type LedgerTransaction } from '@/context/ledger-context';
import { UploadCsvButton } from '@/components/ledger/UploadCsvButton';

const euroFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const monthFormatter = new Intl.DateTimeFormat('nl-NL', {
  month: 'long',
  year: 'numeric',
});

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

type MonthOption = {
  key: string;
  label: string;
};

const formatEuro = (value: number) => euroFormatter.format(value);

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const monthKeyFor = (transaction: LedgerTransaction) => {
  const date = parseDate(transaction.date);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthLabelForKey = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return monthFormatter.format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)));
};

const getCategoryLabel = (transaction: LedgerTransaction) =>
  transaction.mainCategoryName ?? transaction.categoryName ?? transaction.suggestedMainCategoryName ?? 'Nog te beoordelen';

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
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-[#6f6253] transition hover:bg-[#efe7db] hover:text-[#251f1a]"
              >
                <span>{item.label}</span>
                {item.label === 'Te beoordelen' && reviewCount > 0 ? (
                  <span className="rounded-full bg-[#e6b85c] px-2 py-0.5 text-xs text-[#35240a]">{reviewCount}</span>
                ) : null}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}

function Header({ monthOptions, selectedMonth, onMonthChange }: { monthOptions: MonthOption[]; selectedMonth: string; onMonthChange: (value: string) => void }) {
  return (
    <header className="mb-6 rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">Transacties en import</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">Administratie</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
            className="rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm font-semibold text-[#574b3f] outline-none focus:border-[#1f5f4a]"
          >
            {monthOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <Link href="/review" className="rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] px-5 py-3 text-sm font-semibold text-[#574b3f]">
            Te beoordelen
          </Link>
        </div>
      </div>
    </header>
  );
}

function Kpi({ label, value, helper, tone = 'neutral' }: { label: string; value: string; helper: string; tone?: 'income' | 'expense' | 'review' | 'neutral' }) {
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
      <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{label}</div>
      <p className="text-3xl font-semibold tracking-[-0.05em]">{value}</p>
      <p className="mt-2 text-sm text-[#7d6d5a]">{helper}</p>
    </article>
  );
}

function ImportPanel() {
  return (
    <section id="importeren" className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">Importeren</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">ING maandexport</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6253]">
            Upload de CSV-export uit ING. Dubbele transacties worden automatisch genegeerd en onbekende transacties komen in de beoordelingsrij.
          </p>
        </div>
        <UploadCsvButton />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StateCard title="Goed bestand" body="ING CSV met datum, omschrijving, rekening, bedrag en bij/af." />
        <StateCard title="Dubbele import" body="Geen probleem: bestaande transacties worden niet opnieuw toegevoegd." />
        <StateCard title="Verkeerd bestand" body="De app geeft een Nederlandse foutmelding en stopt veilig." />
      </div>
    </section>
  );
}

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[#ded5c8] bg-[#f8f3ec] p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#6f6253]">{body}</p>
    </div>
  );
}

function TransactionTable({ transactions }: { transactions: LedgerTransaction[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return transactions;
    return transactions.filter((transaction) =>
      [transaction.description, transaction.counterpartyAccount, transaction.notificationDetail, transaction.categoryName, transaction.mainCategoryName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query, transactions]);

  return (
    <section id="transacties" className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">Transacties</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Details alleen wanneer nodig</h3>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoeken"
          className="rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]"
        />
      </div>
      {filtered.length ? (
        <div className="overflow-x-auto rounded-[1.5rem] border border-[#ded5c8]">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-[#f5f1ea] text-xs uppercase tracking-[0.14em] text-[#8a7965]">
              <tr>
                <th className="px-4 py-3 font-semibold">Datum</th>
                <th className="px-4 py-3 font-semibold">Omschrijving</th>
                <th className="px-4 py-3 font-semibold">Categorie</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((transaction) => {
                const isExpense = transaction.amount < 0;
                return (
                  <tr key={transaction.id} className="border-t border-[#ded5c8]">
                    <td className="px-4 py-4 text-[#6f6253]">{dateFormatter.format(parseDate(transaction.date))}</td>
                    <td className="px-4 py-4">
                      <details>
                        <summary className="cursor-pointer font-semibold text-[#251f1a] marker:text-[#8a7965]">{transaction.description}</summary>
                        <div className="mt-3 rounded-2xl bg-[#f5f1ea] p-3 text-xs leading-5 text-[#6f6253]">
                          <p>Rekening: {transaction.accountLabel ?? transaction.accountIdentifier ?? 'Onbekend'}</p>
                          <p>Tegenrekening: {transaction.counterpartyAccount ?? 'Onbekend'}</p>
                          <p>Omschrijving: {transaction.notificationDetail ?? 'Geen extra omschrijving'}</p>
                          <p>Saldo na transactie: {typeof transaction.runningBalance === 'number' ? formatEuro(transaction.runningBalance) : 'Niet beschikbaar'}</p>
                        </div>
                      </details>
                    </td>
                    <td className="px-4 py-4 text-[#6f6253]">{getCategoryLabel(transaction)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${transaction.needsManualCategory ? 'bg-[#f5e9c8] text-[#7a5512]' : 'bg-[#e7f0e7] text-[#1f5f4a]'}`}>
                        {transaction.needsManualCategory ? 'Te beoordelen' : 'Verwerkt'}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-semibold ${isExpense ? 'text-[#914f35]' : 'text-[#1f5f4a]'}`}>{formatEuro(transaction.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl bg-[#f5f1ea] p-5 text-sm text-[#6f6253]">Geen transacties gevonden.</p>
      )}
    </section>
  );
}

function YearOverview({ transactions }: { transactions: LedgerTransaction[] }) {
  const byYear = useMemo(() => {
    const years = new Map<number, LedgerTransaction[]>();
    transactions.forEach((transaction) => {
      const year = parseDate(transaction.date).getUTCFullYear();
      years.set(year, [...(years.get(year) ?? []), transaction]);
    });
    return Array.from(years.entries()).sort(([a], [b]) => b - a);
  }, [transactions]);

  const latest = byYear[0];
  const year = latest?.[0] ?? new Date().getUTCFullYear();
  const yearTransactions = latest?.[1] ?? [];
  const income = yearTransactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = yearTransactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return (
    <section id="jaaroverzicht" className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">Jaaroverzicht</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{year} in balans</h3>
        </div>
        <div className="flex gap-2 rounded-full bg-[#f5f1ea] p-1 text-sm font-semibold">
          <span className="rounded-full bg-[#1f5f4a] px-4 py-2 text-[#fbf8f2]">Intern</span>
          <span className="rounded-full px-4 py-2 text-[#6f6253]">ANBI</span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SmallStat label="Inkomsten" value={formatEuro(income)} />
        <SmallStat label="Uitgaven" value={formatEuro(expenses)} />
        <SmallStat label="Resultaat" value={formatEuro(income - expenses)} />
        <SmallStat label="Transacties" value={String(yearTransactions.length)} />
      </div>
      <div className="mt-5 rounded-[1.5rem] bg-[#f5f1ea] p-5 text-sm leading-6 text-[#6f6253]">
        Balansoverdracht en begin-/eindbalans worden in een volgende datamodel-fase definitief gemaakt. Tot die tijd gebruikt dit overzicht de geïmporteerde transacties als basis.
      </div>
    </section>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] bg-[#f5f1ea] p-4">
      <p className="text-sm text-[#7d6d5a]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{value}</p>
    </div>
  );
}

function SettingsConcept() {
  return (
    <section id="instellingen" className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <p className="text-sm font-medium text-[#7d6d5a]">Instellingen</p>
      <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Beheermodus blijft verborgen</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {['Categorieën', 'Projecten/fondsen', 'E-mailontvangers', 'ING-importbestanden', 'Auditlog', 'Veilige beheermodus'].map((item) => (
          <div key={item} className="rounded-[1.25rem] border border-[#ded5c8] bg-[#f8f3ec] p-4 text-sm font-semibold text-[#574b3f]">{item}</div>
        ))}
      </div>
    </section>
  );
}

export default function FinanceLedgerPage() {
  const { transactions, summary } = useLedger();

  const monthOptions = useMemo<MonthOption[]>(() => {
    const keys = Array.from(new Set(transactions.map(monthKeyFor))).sort().reverse();
    if (!keys.length) {
      const now = new Date();
      keys.push(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    return keys.map((key) => ({ key, label: monthLabelForKey(key) }));
  }, [transactions]);

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.key ?? '');
  const activeMonth = monthOptions.some((option) => option.key === selectedMonth) ? selectedMonth : monthOptions[0]?.key ?? selectedMonth;

  const monthTransactions = useMemo(() => transactions.filter((transaction) => monthKeyFor(transaction) === activeMonth), [activeMonth, transactions]);
  const income = monthTransactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = monthTransactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const reviewCount = monthTransactions.filter((tx) => tx.needsManualCategory).length;

  return (
    <AppFrame reviewCount={summary.reviewCount}>
      <Header monthOptions={monthOptions} selectedMonth={activeMonth} onMonthChange={setSelectedMonth} />
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Inkomsten" value={formatEuro(income)} helper="Ontvangen in deze maand" tone="income" />
          <Kpi label="Uitgaven" value={formatEuro(expenses)} helper="Besteed in deze maand" tone="expense" />
          <Kpi label="Saldo verandering" value={formatEuro(income - expenses)} helper="Inkomsten min uitgaven" />
          <Kpi label="Nog te beoordelen" value={String(reviewCount)} helper="Transacties zonder definitieve categorie" tone="review" />
        </section>
        <ImportPanel />
        <TransactionTable transactions={monthTransactions} />
        <YearOverview transactions={transactions} />
        <SettingsConcept />
      </div>
    </AppFrame>
  );
}
