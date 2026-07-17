'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FinanceAppFrame } from '@/ui/FinanceAppFrame';
import {
  canConfirmReviewRow,
  getReviewConfirmLabel,
  getReviewReliability,
  type ReviewConfidenceFilter,
} from '@/helpers/review-ui';
import {
  fetchReview,
  isClientAdmin,
  updateCategory,
  type EvidenceRichReviewItem,
  type EvidenceRichReviewResponse,
  type ReviewCategoryOption,
  type ReviewProjectOption,
  type ReviewTransactionTypeOption,
} from '@/libs/api';

const PAGE_SIZES = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const moneyFormatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

function EmptyReviewState() {
  return (
    <section className="rounded-3xl border border-[#ded5c8] bg-[#fbf8f2] p-8 text-center">
      <h2 className="text-2xl font-semibold">Er zijn geen transacties die beoordeling nodig hebben.</h2>
      <Link href="/" className="mt-5 inline-block rounded-xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-white">Dashboard</Link>
    </section>
  );
}

function ReviewRow({
  item,
  categories,
  projects,
  transactionTypes,
  onConfirmed,
}: {
  item: EvidenceRichReviewItem;
  categories: ReviewCategoryOption[];
  projects: ReviewProjectOption[];
  transactionTypes: ReviewTransactionTypeOption[];
  onConfirmed: () => Promise<void>;
}) {
  const initialProjectId = item.proposed?.projectId ?? '';
  const initialTypeId = item.proposed?.transactionTypeId ?? '';
  const initialCategoryId = item.proposed?.categoryId ?? '';
  const [projectId, setProjectId] = useState(initialProjectId);
  const [transactionTypeId, setTransactionTypeId] = useState(initialTypeId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = isClientAdmin();
  const reliability = getReviewReliability(item);
  const changed = projectId !== initialProjectId || transactionTypeId !== initialTypeId || categoryId !== initialCategoryId;
  const canConfirm = canConfirmReviewRow({ admin, busy, projectId, transactionTypeId, categoryId });
  const compatibleTypes = transactionTypes.filter((type) => type.direction === item.direction);

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await updateCategory(item.transactionId, { projectId, transactionTypeId, categoryId, reason: reason.trim() || null });
      toast.success('Boeking en beoordelingsbesluit opgeslagen.');
      await onConfirmed();
    } catch (error) {
      console.error(error);
      toast.error('De boeking kon niet worden opgeslagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="border-b border-[#ded5c8] bg-[#fbf8f2] p-4 last:border-b-0">
      <div className="grid gap-3 xl:grid-cols-[110px_minmax(190px,1.2fr)_minmax(220px,1.5fr)_110px_minmax(170px,1fr)_minmax(170px,1fr)_minmax(180px,1fr)_145px_140px] xl:items-center">
        <div className="text-sm text-[#6f6253]"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7965] xl:hidden">Datum</span>{dateFormatter.format(new Date(item.displayDate))}</div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7965] xl:hidden">Tegenpartij</span>
          <p className="font-semibold">{item.counterparty ?? 'Onbekende tegenpartij'}</p>
          <p className="text-xs text-[#7d6d5a]">{item.counterpartyIban ?? item.accountIdentifier ?? ''}</p>
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7965] xl:hidden">Omschrijving</span>
          <p className="truncate font-medium" title={item.description}>{item.description}</p>
          <p className="truncate text-xs text-[#7d6d5a]" title={item.paymentPurpose ?? ''}>{item.paymentPurpose ?? 'Geen extra omschrijving'}</p>
        </div>
        <div className={`font-semibold xl:text-right ${item.amount < 0 ? 'text-[#914f35]' : 'text-[#1f5f4a]'}`}><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7965] xl:hidden">Bedrag</span>{moneyFormatter.format(item.amount)}</div>
        <label className="grid gap-1"><span className="text-xs font-semibold uppercase tracking-wide text-[#8a7965] xl:hidden">Project</span><select aria-label="Klant of project" disabled={!admin || busy} value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm">
          <option value="">Kies project</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
        </select></label>
        <label className="grid gap-1"><span className="text-xs font-semibold uppercase tracking-wide text-[#8a7965] xl:hidden">Type</span><select aria-label="Transactietype" disabled={!admin || busy} value={transactionTypeId} onChange={(event) => setTransactionTypeId(event.target.value)} className="w-full rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm">
          <option value="">Kies type</option>
          {compatibleTypes.map((type) => <option key={type.id} value={type.id}>{type.literalName}</option>)}
        </select></label>
        <label className="grid gap-1"><span className="text-xs font-semibold uppercase tracking-wide text-[#8a7965] xl:hidden">Categorie</span><select aria-label="Categorie" disabled={!admin || busy} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="w-full rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm">
          <option value="">Kies categorie</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></label>
        <div><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7965] xl:hidden">Betrouwbaarheid</span><div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${reliability.className}`}>
          <span aria-hidden="true">● </span>{reliability.score === null ? reliability.label : `${reliability.score}% · ${reliability.label}`}
        </div></div>
        <button type="button" onClick={confirm} disabled={!canConfirm} className="w-full rounded-xl bg-[#1f5f4a] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 xl:w-auto">
          {getReviewConfirmLabel({ admin, busy, changed })}
        </button>
      </div>
      <details className="mt-3 rounded-xl bg-[#f5f1ea] px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Bewijs en details</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><strong>Status:</strong> {item.statusLabel}<br /><strong>Reden:</strong> {item.reason}<br /><strong>Bron:</strong> {item.source}</div>
          <div><strong>Regels:</strong> {item.evidence.matchedRuleIds.join(', ') || 'geen'}<br /><strong>Historische records:</strong> {item.evidence.historicalRecordIds.length}<br /><strong>Alternatieven:</strong> {item.alternatives.length}</div>
        </div>
        <label className="mt-3 block font-semibold">Correctienotitie
          <input value={reason} onChange={(event) => setReason(event.target.value)} disabled={!admin || busy} placeholder="Optioneel; wordt onderdeel van de audit" className="mt-1 w-full rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 font-normal" />
        </label>
      </details>
    </article>
  );
}

export default function FinanceReviewPage() {
  const [data, setData] = useState<EvidenceRichReviewResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [confidence, setConfidence] = useState<ReviewConfidenceFilter>('all');
  const [direction, setDirection] = useState<'all' | 'credit' | 'debit'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'incomplete'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchReview({
        page,
        pageSize,
        confidence: confidence === 'all' ? null : confidence,
        direction: direction === 'all' ? null : direction,
        projectId: projectFilter || null,
        categoryId: categoryFilter || null,
        state: stateFilter,
      });
      setData(response);
      if (page > response.pagination.totalPages) setPage(response.pagination.totalPages);
    } catch (error) {
      console.error(error);
      toast.error('De beoordelingsrij kon niet worden geladen.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, confidence, direction, projectFilter, categoryFilter, stateFilter]);

  useEffect(() => { void load(); }, [load]);

  const visibleTransactions = data?.transactions ?? [];

  const pagination = data?.pagination;
  return (
    <FinanceAppFrame reviewCount={pagination?.totalItems ?? 0} activeHref="/review">
      <header className="mb-4 rounded-3xl border border-[#ded5c8] bg-[#fbf8f2] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-sm font-medium text-[#7d6d5a]">Te beoordelen</p><h1 className="text-3xl font-semibold">Transacties controleren</h1><p className="mt-1 text-sm text-[#6f6253]">Controleer de voorgestelde classificatie en bevestig iedere transactie afzonderlijk.</p></div>
          <div className="rounded-2xl bg-[#f5e9c8] px-5 py-3 text-center"><strong className="text-2xl">{pagination?.totalItems ?? 0}</strong><div className="text-xs">open</div></div>
        </div>
      </header>

      <section className="mb-4 grid gap-3 rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] p-4 md:grid-cols-2 xl:grid-cols-6">
        <select aria-label="Betrouwbaarheid filter" value={confidence} onChange={(event) => { setConfidence(event.target.value as ReviewConfidenceFilter); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="all">Alle betrouwbaarheid</option><option value="green">Zeer betrouwbaar</option><option value="amber">Controleer zorgvuldig</option><option value="red">Onzeker</option><option value="gray">Onvoldoende bewijs</option></select>
        <select aria-label="Richting filter" value={direction} onChange={(event) => { setDirection(event.target.value as typeof direction); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="all">Alle richtingen</option><option value="debit">Afschrijvingen</option><option value="credit">Bijschrijvingen</option></select>
        <select aria-label="Project filter" value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="">Alle projecten</option>{data?.projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select>
        <select aria-label="Categorie filter" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="">Alle categorieën</option>{data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select aria-label="Status filter" value={stateFilter} onChange={(event) => { setStateFilter(event.target.value as 'all' | 'incomplete'); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="all">Alle open transacties</option><option value="incomplete">Onvolledige voorstellen</option></select>
        <select aria-label="Aantal per pagina" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as PageSize); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per pagina</option>)}</select>
      </section>

      {loading && !data ? <div className="rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] p-8 text-center">Laden…</div> : null}
      {!loading && data && data.pagination.totalItems === 0 ? <EmptyReviewState /> : null}
      {data && data.pagination.totalItems > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-[#ded5c8] bg-[#fbf8f2]">
          <div className="hidden bg-[#f5f1ea] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#7d6d5a] xl:grid xl:grid-cols-[110px_minmax(190px,1.2fr)_minmax(220px,1.5fr)_110px_minmax(170px,1fr)_minmax(170px,1fr)_minmax(180px,1fr)_145px_140px] xl:gap-3"><span>Datum</span><span>Tegenpartij</span><span>Omschrijving</span><span className="text-right">Bedrag</span><span>Project</span><span>Type</span><span>Categorie</span><span>Betrouwbaarheid</span><span>Actie</span></div>
          {visibleTransactions.map((item) => <ReviewRow key={item.transactionId} item={item} categories={data.categories} projects={data.projects} transactionTypes={data.transactionTypes} onConfirmed={load} />)}
          {!visibleTransactions.length ? <div className="p-8 text-center text-sm text-[#6f6253]">Geen transacties op deze pagina voldoen aan de filters.</div> : null}
        </section>
      ) : null}

      {pagination ? <nav aria-label="Paginering" className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] p-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm">Pagina {pagination.page} van {pagination.totalPages} · {pagination.totalItems} transacties</span><div className="flex gap-2"><button type="button" disabled={!pagination.hasPreviousPage || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-[#d7cdbf] px-4 py-2 text-sm font-semibold disabled:opacity-40">Vorige</button><button type="button" disabled={!pagination.hasNextPage || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-[#1f5f4a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Volgende</button></div></nav> : null}
    </FinanceAppFrame>
  );
}
