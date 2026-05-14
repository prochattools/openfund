'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useLedger, type Category, type LedgerTransaction } from '@/context/ledger-context';

const euroFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const formatEuro = (value: number) => euroFormatter.format(value);

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

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

function Header({ count }: { count: number }) {
  return (
    <header className="mb-6 rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">Te beoordelen</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">Categorieën afronden</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6253]">
            Alleen transacties zonder definitieve categorie komen hier terecht. Accepteer een suggestie of kies zelf een categorie.
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-[#f5e9c8] px-5 py-4 text-center text-[#7a5512]">
          <p className="text-3xl font-semibold tracking-[-0.05em]">{count}</p>
          <p className="text-sm font-semibold">open</p>
        </div>
      </div>
    </header>
  );
}

function EmptyReviewState() {
  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-8 text-center shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a7965]">Alles is bijgewerkt</p>
      <h3 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.05em]">Er zijn geen transacties die beoordeling nodig hebben.</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6f6253]">Je kunt terug naar het dashboard of een nieuwe ING maandexport importeren.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2]">Dashboard</Link>
        <Link href="/ledger#importeren" className="rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] px-5 py-3 text-sm font-semibold text-[#574b3f]">Importeren</Link>
      </div>
    </section>
  );
}

const getSuggestedMain = (transaction: LedgerTransaction) =>
  transaction.mainCategoryId ?? transaction.suggestedMainCategoryName ?? transaction.rawMainCategoryName ?? '';

const getSuggestedSub = (transaction: LedgerTransaction) =>
  transaction.categoryId ?? transaction.suggestedSubCategoryName ?? transaction.rawCategoryName ?? '';

const normalizeLabel = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const findCategoryIdByName = (categories: Category[], name: string | null | undefined) => {
  const normalized = normalizeLabel(name);
  if (!normalized) return '';
  return categories.find((category) => normalizeLabel(category.name) === normalized)?.id ?? '';
};

function ReviewCard({
  transaction,
  mainCategories,
  subcategories,
  onAssign,
}: {
  transaction: LedgerTransaction;
  mainCategories: Category[];
  subcategories: Record<string, Category[]>;
  onAssign: (transactionId: string, payload: { categoryId?: string | null; mainCategoryId?: string | null; categoryName?: string }) => Promise<void>;
}) {
  const suggestedMain = getSuggestedMain(transaction);
  const defaultMain =
    transaction.mainCategoryId ??
    (typeof suggestedMain === 'string' && suggestedMain.startsWith('main:') ? suggestedMain : findCategoryIdByName(mainCategories, suggestedMain));
  const initialSubs = defaultMain ? subcategories[defaultMain] ?? [] : [];
  const suggestedSub = getSuggestedSub(transaction);
  const defaultSub =
    transaction.categoryId ??
    (typeof suggestedSub === 'string' && suggestedSub.includes(' — ')
      ? ''
      : findCategoryIdByName(initialSubs, suggestedSub));
  const [mainId, setMainId] = useState(defaultMain);
  const [subId, setSubId] = useState(defaultSub);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isExpense = transaction.amount < 0;
  const availableSubs = mainId ? subcategories[mainId] ?? [] : [];
  const suggestedLabel = transaction.suggestedSubCategoryName ?? transaction.categoryName ?? transaction.suggestedMainCategoryName ?? transaction.mainCategoryName ?? 'Geen suggestie';

  const save = async () => {
    if (!mainId && !subId && !note.trim()) {
      toast.error('Kies een categorie of vul een nieuwe categorie in.');
      return;
    }
    setBusy(true);
    try {
      await onAssign(transaction.id, {
        mainCategoryId: mainId || undefined,
        categoryId: subId || undefined,
        categoryName: note.trim() || undefined,
      });
      toast.success('Transactie opgeslagen.');
    } catch (error) {
      console.error(error);
      toast.error('De transactie kon niet worden opgeslagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">{dateFormatter.format(parseDate(transaction.date))}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{transaction.description}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6253]">{transaction.notificationDetail ?? 'Geen extra omschrijving'}</p>
        </div>
        <p className={`text-3xl font-semibold tracking-[-0.05em] ${isExpense ? 'text-[#914f35]' : 'text-[#1f5f4a]'}`}>{formatEuro(transaction.amount)}</p>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-[#f5f1ea] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a7965]">Suggestie</p>
        <p className="mt-2 font-semibold">{suggestedLabel}</p>
        <p className="mt-1 text-sm text-[#6f6253]">{transaction.suggestionConfidence ? `Match: ${transaction.suggestionConfidence}` : 'Geen volledige historische match'}</p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-sm font-semibold text-[#574b3f]">
          Hoofdcategorie
          <select value={mainId} onChange={(event) => { setMainId(event.target.value); setSubId(''); }} className="mt-2 w-full rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]">
            <option value="">Kies hoofdcategorie</option>
            {mainCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#574b3f]">
          Subcategorie
          <select value={subId} onChange={(event) => setSubId(event.target.value)} disabled={!mainId} className="mt-2 w-full rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a] disabled:opacity-60">
            <option value="">Kies subcategorie</option>
            {availableSubs.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#574b3f]">
          Nieuwe categorie
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optioneel" className="mt-2 w-full rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]" />
        </label>
        <div className="flex items-end">
          <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2] disabled:opacity-60 lg:w-auto">
            {busy ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </article>
  );
}

function ReviewTableMode({ transactions }: { transactions: LedgerTransaction[] }) {
  return (
    <details className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <summary className="cursor-pointer text-lg font-semibold tracking-[-0.03em]">Tabelweergave</summary>
      <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-[#ded5c8]">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-[#f5f1ea] text-xs uppercase tracking-[0.14em] text-[#8a7965]">
            <tr>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Omschrijving</th>
              <th className="px-4 py-3">Suggestie</th>
              <th className="px-4 py-3 text-right">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-t border-[#ded5c8]">
                <td className="px-4 py-4 text-[#6f6253]">{dateFormatter.format(parseDate(transaction.date))}</td>
                <td className="px-4 py-4 font-semibold">{transaction.description}</td>
                <td className="px-4 py-4 text-[#6f6253]">{transaction.suggestedSubCategoryName ?? transaction.categoryName ?? 'Geen suggestie'}</td>
                <td className={`px-4 py-4 text-right font-semibold ${transaction.amount < 0 ? 'text-[#914f35]' : 'text-[#1f5f4a]'}`}>{formatEuro(transaction.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function FinanceReviewPage() {
  const { reviewTransactions, categoryTree, assignCategory, summary } = useLedger();
  const mainCategories = useMemo(() => categoryTree.main.filter((category) => category.id !== 'cat-review'), [categoryTree.main]);
  const subcategories = useMemo(() => {
    const result: Record<string, Category[]> = {};
    mainCategories.forEach((main) => {
      result[main.id] = (categoryTree.byParent[main.id] ?? []).filter((category) => category.id !== 'sub-review-needs-category');
    });
    return result;
  }, [categoryTree.byParent, mainCategories]);

  return (
    <AppFrame reviewCount={summary.reviewCount}>
      <Header count={reviewTransactions.length} />
      {reviewTransactions.length ? (
        <div className="space-y-6">
          {reviewTransactions.slice(0, 1).map((transaction) => (
            <ReviewCard key={transaction.id} transaction={transaction} mainCategories={mainCategories} subcategories={subcategories} onAssign={assignCategory} />
          ))}
          {reviewTransactions.length > 1 ? (
            <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
              <p className="text-sm font-medium text-[#7d6d5a]">Volgende transacties</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {reviewTransactions.slice(1, 7).map((transaction) => (
                  <div key={transaction.id} className="rounded-[1.25rem] border border-[#ded5c8] bg-[#f8f3ec] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#8a7965]">{dateFormatter.format(parseDate(transaction.date))}</p>
                        <p className="mt-1 font-semibold">{transaction.description}</p>
                      </div>
                      <p className={`font-semibold ${transaction.amount < 0 ? 'text-[#914f35]' : 'text-[#1f5f4a]'}`}>{formatEuro(transaction.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <ReviewTableMode transactions={reviewTransactions} />
        </div>
      ) : (
        <EmptyReviewState />
      )}
    </AppFrame>
  );
}
