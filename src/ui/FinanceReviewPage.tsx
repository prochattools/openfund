'use client';

import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useLedger } from '@/context/ledger-context';
import { FinanceAppFrame } from '@/ui/FinanceAppFrame';
import type { LedgerTransaction } from '@/helpers/api-transaction-mapper';
import {
  buildReviewApprovalPayload,
  canAcceptReviewSuggestion,
  formatReviewEuro,
  getReviewSuggestedLabel,
  isReviewPlaceholderCategory,
  parseReviewDate,
  resolveDefaultReviewCategory,
  translateSuggestionConfidence,
} from '@/helpers/review-page';
import {
  isClientAdmin,
  type ReviewCategoryOption,
  type ReviewProjectOption,
  type ReviewTransactionTypeOption,
} from '@/libs/api';

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const formatEuro = formatReviewEuro;

function Header({ count }: { count: number }) {
  return (
    <header className="mb-6 rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">Te beoordelen</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">Boekingen afronden</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f6253]">
            Iedere transactie start met een complete lokale suggestie voor klant/project, transactietype en categorie. De suggestie is nooit definitief totdat een beheerder haar goedkeurt of corrigeert.
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

type AssignPayload = {
  categoryId: string;
  projectId: string;
  transactionTypeId: string;
  reason?: string | null;
};

function ReviewCard({
  transaction,
  categories,
  projects,
  transactionTypes,
  onAssign,
}: {
  transaction: LedgerTransaction;
  categories: ReviewCategoryOption[];
  projects: ReviewProjectOption[];
  transactionTypes: ReviewTransactionTypeOption[];
  onAssign: (transactionId: string, payload: AssignPayload) => Promise<void>;
}) {
  const [projectId, setProjectId] = useState(transaction.reviewProposal?.projectId ?? '');
  const [transactionTypeId, setTransactionTypeId] = useState(transaction.reviewProposal?.transactionTypeId ?? '');
  const [categoryId, setCategoryId] = useState(() => resolveDefaultReviewCategory(transaction, categories));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canReview = isClientAdmin();
  const isExpense = transaction.amount < 0;
  const compatibleTypes = transactionTypes.filter((item) => !transaction.direction || item.direction === transaction.direction);
  const suggestedLabel = getReviewSuggestedLabel(transaction);
  const canAcceptSuggestion = canAcceptReviewSuggestion(canReview, projectId, transactionTypeId, categoryId);

  const applyAlternative = (index: number) => {
    const alternative = transaction.reviewAlternatives?.[index];
    if (!alternative?.complete || !alternative.projectId || !alternative.transactionTypeId || !alternative.categoryId) return;
    setProjectId(alternative.projectId);
    setTransactionTypeId(alternative.transactionTypeId);
    setCategoryId(alternative.categoryId);
  };

  const save = async () => {
    if (!canReview) {
      toast.error('Alleen beheerders mogen transacties boeken.');
      return;
    }

    const payload = buildReviewApprovalPayload({
      projectId,
      transactionTypeId,
      categoryId,
      reason,
    });
    if (!payload) {
      toast.error('Kies een klant/project, transactietype en categorie.');
      return;
    }

    setBusy(true);
    try {
      await onAssign(transaction.id, payload);
      toast.success('Boeking en beoordelingsbesluit opgeslagen.');
    } catch (error) {
      console.error(error);
      toast.error('De boeking kon niet worden opgeslagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">{dateFormatter.format(parseReviewDate(transaction.date))}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{transaction.description}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6253]">{transaction.notificationDetail ?? 'Geen extra omschrijving'}</p>
        </div>
        <p className={`text-3xl font-semibold tracking-[-0.05em] ${isExpense ? 'text-[#914f35]' : 'text-[#1f5f4a]'}`}>{formatEuro(transaction.amount)}</p>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-[#f5f1ea] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a7965]">Lokale suggestie · menselijk akkoord vereist</p>
            <p className="mt-2 font-semibold">{suggestedLabel}</p>
            <p className="mt-1 text-sm text-[#6f6253]">Zekerheid: {transaction.reviewConfidenceLabel ?? translateSuggestionConfidence(transaction.suggestionConfidence)}</p>
            {transaction.reviewReason ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f6253]">{transaction.reviewReason}</p> : null}
            {transaction.reviewEvidenceSummary ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8a7965]">{transaction.reviewEvidenceSummary}</p> : null}
          </div>
          <button type="button" onClick={save} disabled={busy || !canAcceptSuggestion} className="rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2] disabled:opacity-60">
            {!canReview ? 'Alleen beheerder' : busy ? 'Opslaan…' : 'Suggestie goedkeuren'}
          </button>
        </div>

        {transaction.reviewAlternatives?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {transaction.reviewAlternatives.map((alternative, index) => (
              <button
                key={alternative.suggestionId}
                type="button"
                onClick={() => applyAlternative(index)}
                disabled={!alternative.complete}
                className="rounded-xl border border-[#d7cdbf] bg-[#fbf8f2] px-3 py-2 text-left text-xs disabled:opacity-50"
              >
                <span className="font-semibold">#{alternative.rank} {alternative.projectLabel ?? alternative.projectCode ?? 'Project'} · {alternative.transactionTypeLabel ?? 'Type'} · {alternative.categoryLabel ?? 'Categorie'}</span>
                <span className="ml-2 text-[#7d6d5a]">{alternative.confidenceLabel}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold text-[#574b3f]">
          Klant / project
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]">
            <option value="">Kies klant/project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold text-[#574b3f]">
          Transactietype
          <select value={transactionTypeId} onChange={(event) => setTransactionTypeId(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]">
            <option value="">Kies transactietype</option>
            {compatibleTypes.map((item) => <option key={item.id} value={item.id}>{item.literalName}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold text-[#574b3f] md:col-span-2">
          Categorie
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]">
            <option value="">Kies categorie</option>
            {categories.filter((category) => !isReviewPlaceholderCategory(category)).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 text-sm font-semibold text-[#574b3f]">
          Reden of correctienotitie
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optioneel; wordt onderdeel van het beoordelingsbesluit" className="mt-2 w-full rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]" />
        </label>
        <button onClick={save} disabled={busy || !canAcceptSuggestion} className="rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2] disabled:opacity-60">
          {!canReview ? 'Alleen beheerder' : busy ? 'Opslaan…' : 'Boeking goedkeuren'}
        </button>
      </div>
    </article>
  );
}

function ReviewTableMode({ transactions }: { transactions: LedgerTransaction[] }) {
  return (
    <details className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <summary className="cursor-pointer text-lg font-semibold tracking-[-0.03em]">Tabelweergave</summary>
      <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-[#ded5c8]">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-[#f5f1ea] text-xs uppercase tracking-[0.14em] text-[#8a7965]">
            <tr>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Omschrijving</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Categorie</th>
              <th className="px-4 py-3 text-right">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-t border-[#ded5c8]">
                <td className="px-4 py-4 text-[#6f6253]">{dateFormatter.format(parseReviewDate(transaction.date))}</td>
                <td className="px-4 py-4 font-semibold">{transaction.description}</td>
                <td className="px-4 py-4 text-[#6f6253]">{transaction.reviewProposal?.projectLabel ?? transaction.reviewProposal?.projectCode ?? 'Geen voorstel'}</td>
                <td className="px-4 py-4 text-[#6f6253]">{transaction.reviewProposal?.transactionTypeLabel ?? 'Geen voorstel'}</td>
                <td className="px-4 py-4 text-[#6f6253]">{transaction.reviewProposal?.categoryLabel ?? 'Geen voorstel'}</td>
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
  const {
    reviewTransactions,
    reviewProjects,
    reviewTransactionTypes,
    reviewCategories,
    assignCategory,
    summary,
  } = useLedger();
  return (
    <FinanceAppFrame reviewCount={summary.reviewCount} activeHref="/review">
      <Header count={reviewTransactions.length} />
      {reviewTransactions.length ? (
        <div className="space-y-6">
          {reviewTransactions.slice(0, 1).map((transaction) => (
            <ReviewCard
              key={transaction.id}
              transaction={transaction}
              categories={reviewCategories}
              projects={reviewProjects}
              transactionTypes={reviewTransactionTypes}
              onAssign={assignCategory}
            />
          ))}
          {reviewTransactions.length > 1 ? (
            <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
              <p className="text-sm font-medium text-[#7d6d5a]">Volgende transacties</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {reviewTransactions.slice(1, 7).map((transaction) => (
                  <div key={transaction.id} className="rounded-[1.25rem] border border-[#ded5c8] bg-[#f8f3ec] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#8a7965]">{dateFormatter.format(parseReviewDate(transaction.date))}</p>
                        <p className="mt-1 font-semibold">{transaction.description}</p>
                        <p className="mt-2 text-xs text-[#6f6253]">{transaction.reviewProposal?.projectLabel ?? transaction.reviewProposal?.projectCode ?? 'Geen projectvoorstel'} · {transaction.reviewProposal?.transactionTypeLabel ?? 'Geen typevoorstel'} · {transaction.reviewProposal?.categoryLabel ?? 'Geen categorievoorstel'}</p>
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
    </FinanceAppFrame>
  );
}
