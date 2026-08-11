'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FinanceAppFrame } from '@/ui/FinanceAppFrame';
import {
  canConfirmReviewRow,
  getReviewConfirmLabel,
  getReviewReliability,
  getReviewSelectionValidity,
  type ReviewConfidenceFilter,
} from '@/helpers/review-ui';
import {
  createReferenceCategory,
  createReferenceProject,
  createReferenceTransactionType,
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
const INVALID_SELECT_VALUE = '__invalid-review-selection__';
type InlineReferenceKind = 'project' | 'transactionType' | 'category';
type InlineTypeDirection = 'credit' | 'debit' | 'both';

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
  onCreateProject,
  onCreateTransactionType,
  onCreateCategory,
}: {
  item: EvidenceRichReviewItem;
  categories: ReviewCategoryOption[];
  projects: ReviewProjectOption[];
  transactionTypes: ReviewTransactionTypeOption[];
  onConfirmed: () => Promise<void>;
  onCreateProject: (name: string) => Promise<ReviewProjectOption>;
  onCreateTransactionType: (literalName: string, direction: 'credit' | 'debit' | null) => Promise<ReviewTransactionTypeOption>;
  onCreateCategory: (name: string) => Promise<ReviewCategoryOption>;
}) {
  const initialProjectId = item.proposed?.projectId ?? '';
  const initialTypeId = item.proposed?.transactionTypeId ?? '';
  const initialCategoryId = item.proposed?.categoryId ?? '';
  const [projectId, setProjectId] = useState(initialProjectId);
  const [transactionTypeId, setTransactionTypeId] = useState(initialTypeId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [inlineReferenceKind, setInlineReferenceKind] = useState<InlineReferenceKind | null>(null);
  const [inlineReferenceName, setInlineReferenceName] = useState('');
  const [inlineTypeDirection, setInlineTypeDirection] = useState<InlineTypeDirection>(item.direction);
  const [creatingReference, setCreatingReference] = useState(false);
  const admin = isClientAdmin();
  const interactionBusy = busy || creatingReference;
  const reliability = getReviewReliability(item);
  const changed = projectId !== initialProjectId || transactionTypeId !== initialTypeId || categoryId !== initialCategoryId;
  const compatibleTypes = transactionTypes.filter((type) => type.direction === null || type.direction === item.direction);
  const selectionValidity = getReviewSelectionValidity({
    admin,
    busy: interactionBusy,
    projectId,
    transactionTypeId,
    categoryId,
    projects,
    transactionTypes,
    compatibleTransactionTypes: compatibleTypes,
    categories,
  });
  const canConfirm = selectionValidity.canConfirm && canConfirmReviewRow({ admin, busy: interactionBusy, projectId, transactionTypeId, categoryId });
  const projectIssue = selectionValidity.issues.find((issue) => issue.field === 'project');
  const transactionTypeIssue = selectionValidity.issues.find((issue) => issue.field === 'transactionType');
  const categoryIssue = selectionValidity.issues.find((issue) => issue.field === 'category');
  const projectValue = projectIssue?.code === 'unavailable-project' ? INVALID_SELECT_VALUE : projectId;
  const transactionTypeValue = transactionTypeIssue?.code === 'unavailable-transaction-type'
    || transactionTypeIssue?.code === 'wrong-direction-transaction-type'
    ? INVALID_SELECT_VALUE
    : transactionTypeId;
  const categoryValue = categoryIssue?.code === 'unavailable-category' ? INVALID_SELECT_VALUE : categoryId;
  const hasSelectionWarnings = selectionValidity.issues.length > 0;
  const warningId = `review-selection-warning-${item.transactionId}`;
  const projectWarningId = `${warningId}-project`;
  const transactionTypeWarningId = `${warningId}-transaction-type`;
  const categoryWarningId = `${warningId}-category`;

  const renderSelectionWarning = (issue: typeof selectionValidity.issues[number], rawIdLabel: string, id: string) => (
    <div id={id} className="mt-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" aria-live="polite">
      <div className="font-semibold">{issue.message}</div>
      {issue.rawId ? <div className="mt-1 text-[11px] text-amber-800">{rawIdLabel}: {issue.rawId}</div> : null}
    </div>
  );

  const openInlineReference = (kind: InlineReferenceKind) => {
    setInlineReferenceKind(kind);
    setInlineReferenceName('');
    setInlineTypeDirection(item.direction);
  };

  const closeInlineReference = () => {
    if (creatingReference) return;
    setInlineReferenceKind(null);
    setInlineReferenceName('');
    setInlineTypeDirection(item.direction);
  };

  const createInlineReference = async () => {
    if (!admin || creatingReference || !inlineReferenceKind) return;
    const name = inlineReferenceName.trim();
    if (!name) {
      toast.error('Vul eerst een naam in.');
      return;
    }

    setCreatingReference(true);
    try {
      if (inlineReferenceKind === 'project') {
        const project = await onCreateProject(name);
        setProjectId(project.id);
        toast.success(`Klant “${project.name}” toegevoegd en geselecteerd.`);
      } else if (inlineReferenceKind === 'transactionType') {
        const direction = inlineTypeDirection === 'both' ? null : inlineTypeDirection;
        const transactionType = await onCreateTransactionType(name, direction);
        setTransactionTypeId(transactionType.id);
        toast.success(`Type “${transactionType.literalName}” toegevoegd en geselecteerd.`);
      } else {
        const category = await onCreateCategory(name);
        setCategoryId(category.id);
        toast.success(`Category “${category.name}” toegevoegd en geselecteerd.`);
      }
      setInlineReferenceKind(null);
      setInlineReferenceName('');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'De nieuwe waarde kon niet worden toegevoegd.');
    } finally {
      setCreatingReference(false);
    }
  };

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
    <article className="min-w-0 border-b border-[#ded5c8] bg-[#fbf8f2] p-4 last:border-b-0">
      <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr_1fr_auto]">
        <div className="text-sm text-[#6f6253]">{dateFormatter.format(new Date(item.displayDate))}</div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.counterparty ?? 'Onbekende tegenpartij'}</p>
          <p className="truncate text-xs text-[#7d6d5a]">{item.counterpartyIban ?? item.accountIdentifier ?? ''}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium" title={item.description}>{item.description}</p>
          <p className="truncate text-xs text-[#7d6d5a]" title={item.paymentPurpose ?? ''}>{item.paymentPurpose ?? 'Geen extra omschrijving'}</p>
        </div>
        <div className={`text-right font-semibold whitespace-nowrap ${item.amount < 0 ? 'text-[#914f35]' : 'text-[#1f5f4a]'}`}>{moneyFormatter.format(item.amount)}</div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <div className="grid min-w-0 gap-1" aria-describedby={projectIssue ? projectWarningId : undefined}>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8a7965]">Klant</span>
          <select aria-label="Klant" aria-invalid={Boolean(projectIssue)} disabled={!admin || interactionBusy} value={projectValue} onChange={(event) => setProjectId(event.target.value)} className="min-w-0 w-full rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm">
            {projectIssue?.code === 'unavailable-project' ? <option value={INVALID_SELECT_VALUE} disabled>Ongeldig voorstel — kies opnieuw</option> : null}
            <option value="">Kies klant</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.code === project.name ? project.name : `${project.code} · ${project.name}`}</option>)}
          </select>
          {admin ? <button type="button" disabled={interactionBusy} onClick={() => openInlineReference('project')} className="text-left text-xs font-semibold text-[#1f5f4a] disabled:opacity-50">+ Nieuwe Klant</button> : null}
          {projectIssue ? renderSelectionWarning(projectIssue, 'Voorgestelde project-id', projectWarningId) : null}
        </div>
        <div className="grid min-w-0 gap-1" aria-describedby={transactionTypeIssue ? transactionTypeWarningId : undefined}>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8a7965]">Type</span>
          <select aria-label="Transactietype" aria-invalid={Boolean(transactionTypeIssue)} disabled={!admin || interactionBusy} value={transactionTypeValue} onChange={(event) => setTransactionTypeId(event.target.value)} className="min-w-0 w-full rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm">
            {transactionTypeIssue?.code === 'unavailable-transaction-type' || transactionTypeIssue?.code === 'wrong-direction-transaction-type'
              ? <option value={INVALID_SELECT_VALUE} disabled>Ongeldig voorstel — kies opnieuw</option>
              : null}
            {!compatibleTypes.length
              ? <option value="" disabled>Geen typen voor deze richting — voeg een nieuw Type toe</option>
              : <option value="">Kies type</option>}
            {compatibleTypes.map((type) => <option key={type.id} value={type.id}>{type.literalName}</option>)}
          </select>
          {admin ? <button type="button" disabled={interactionBusy} onClick={() => openInlineReference('transactionType')} className="text-left text-xs font-semibold text-[#1f5f4a] disabled:opacity-50">+ Nieuw Type</button> : null}
          {transactionTypeIssue ? renderSelectionWarning(transactionTypeIssue, 'Voorgestelde transactietype-id', transactionTypeWarningId) : null}
        </div>
        <div className="grid min-w-0 gap-1" aria-describedby={categoryIssue ? categoryWarningId : undefined}>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8a7965]">Category</span>
          <select aria-label="Category" aria-invalid={Boolean(categoryIssue)} disabled={!admin || interactionBusy} value={categoryValue} onChange={(event) => setCategoryId(event.target.value)} className="min-w-0 w-full rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm">
            {categoryIssue?.code === 'unavailable-category' ? <option value={INVALID_SELECT_VALUE} disabled>Ongeldig voorstel — kies opnieuw</option> : null}
            <option value="">Kies Category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          {admin ? <button type="button" disabled={interactionBusy} onClick={() => openInlineReference('category')} className="text-left text-xs font-semibold text-[#1f5f4a] disabled:opacity-50">+ Nieuwe Category</button> : null}
          {categoryIssue ? renderSelectionWarning(categoryIssue, 'Voorgestelde Category-id', categoryWarningId) : null}
        </div>
        <div className="grid min-w-0 gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8a7965]">Betrouwbaarheid</span>
          <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${reliability.className}`}>
            <span aria-hidden="true">● </span>{reliability.score === null ? reliability.label : `${reliability.score}% · ${reliability.label}`}
          </div>
        </div>
        <div className="grid min-w-0 gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8a7965]">Actie</span>
          <button type="button" onClick={confirm} disabled={!canConfirm} aria-describedby={hasSelectionWarnings ? warningId : undefined} className="w-full rounded-xl bg-[#1f5f4a] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {getReviewConfirmLabel({ admin, busy, changed })}
          </button>
        </div>
      </div>
      {inlineReferenceKind ? (
        <div className="mt-3 rounded-2xl border border-[#c9dfd5] bg-[#eef7f2] p-4" role="region" aria-label="Nieuwe referentiewaarde toevoegen">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">
              {inlineReferenceKind === 'project' ? 'Nieuwe Klant' : inlineReferenceKind === 'transactionType' ? 'Nieuw Type' : 'Nieuwe Category'}
              <input
                autoFocus
                value={inlineReferenceName}
                disabled={creatingReference}
                onChange={(event) => setInlineReferenceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void createInlineReference();
                  }
                  if (event.key === 'Escape') closeInlineReference();
                }}
                placeholder={inlineReferenceKind === 'project' ? 'Naam van de Klant' : inlineReferenceKind === 'transactionType' ? 'Naam van het Type' : 'Naam van de Category'}
                className="rounded-xl border border-[#b9cfc5] bg-white px-3 py-2 font-normal"
              />
            </label>
            {inlineReferenceKind === 'transactionType' ? (
              <label className="grid gap-1 text-sm font-semibold">
                Richting
                <select value={inlineTypeDirection} disabled={creatingReference} onChange={(event) => setInlineTypeDirection(event.target.value as InlineTypeDirection)} className="rounded-xl border border-[#b9cfc5] bg-white px-3 py-2 font-normal">
                  <option value="debit">Afschrijving</option>
                  <option value="credit">Bijschrijving</option>
                  <option value="both">Beide richtingen</option>
                </select>
              </label>
            ) : null}
            <div className="flex gap-2">
              <button type="button" disabled={creatingReference || !inlineReferenceName.trim()} onClick={() => void createInlineReference()} className="rounded-xl bg-[#1f5f4a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {creatingReference ? 'Toevoegen…' : 'Toevoegen en selecteren'}
              </button>
              <button type="button" disabled={creatingReference} onClick={closeInlineReference} className="rounded-xl border border-[#b9cfc5] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Annuleren</button>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#476554]">De nieuwe waarde wordt direct actief en alleen voor deze transactie geselecteerd. Bevestigen blijft een aparte handeling.</p>
        </div>
      ) : null}
      {hasSelectionWarnings ? (
        <div id={warningId} className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status" aria-live="polite">
          <p className="font-semibold">Controleer het voorstel opnieuw voordat je bevestigt.</p>
          <ul className="mt-2 list-disc pl-5">
            {selectionValidity.issues.map((issue) => <li key={issue.field}>{issue.message}</li>)}
          </ul>
        </div>
      ) : null}
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

  const createProjectOption = useCallback(async (name: string): Promise<ReviewProjectOption> => {
    const item = await createReferenceProject({ code: name, name });
    const option = { id: item.id, code: item.code, name: item.name };
    setData((current) => current ? {
      ...current,
      projects: [...current.projects.filter((project) => project.id !== option.id), option]
        .sort((left, right) => left.name.localeCompare(right.name, 'nl')),
    } : current);
    return option;
  }, []);

  const createTransactionTypeOption = useCallback(async (
    literalName: string,
    typeDirection: 'credit' | 'debit' | null,
  ): Promise<ReviewTransactionTypeOption> => {
    const item = await createReferenceTransactionType({ literalName, direction: typeDirection });
    const option = { id: item.id, literalName: item.literalName, direction: item.direction };
    setData((current) => current ? {
      ...current,
      transactionTypes: [...current.transactionTypes.filter((type) => type.id !== option.id), option]
        .sort((left, right) => left.literalName.localeCompare(right.literalName, 'nl')),
    } : current);
    return option;
  }, []);

  const createCategoryOption = useCallback(async (name: string): Promise<ReviewCategoryOption> => {
    const item = await createReferenceCategory({ name });
    const option = { id: item.id, name: item.name };
    setData((current) => current ? {
      ...current,
      categories: [...current.categories.filter((category) => category.id !== option.id), option]
        .sort((left, right) => left.name.localeCompare(right.name, 'nl')),
    } : current);
    return option;
  }, []);

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

      <section className="mb-4 grid gap-3 rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <select aria-label="Betrouwbaarheid filter" value={confidence} onChange={(event) => { setConfidence(event.target.value as ReviewConfidenceFilter); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="all">Alle betrouwbaarheid</option><option value="green">Zeer betrouwbaar</option><option value="amber">Controleer zorgvuldig</option><option value="red">Onzeker</option><option value="gray">Onvoldoende bewijs</option></select>
        <select aria-label="Richting filter" value={direction} onChange={(event) => { setDirection(event.target.value as typeof direction); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="all">Alle richtingen</option><option value="debit">Afschrijvingen</option><option value="credit">Bijschrijvingen</option></select>
        <select aria-label="Klant filter" value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="">Alle klanten</option>{data?.projects.map((project) => <option key={project.id} value={project.id}>{project.code === project.name ? project.name : `${project.code} · ${project.name}`}</option>)}</select>
        <select aria-label="Categorie filter" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="">Alle categorieën</option>{data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select aria-label="Status filter" value={stateFilter} onChange={(event) => { setStateFilter(event.target.value as 'all' | 'incomplete'); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm"><option value="all">Alle open transacties</option><option value="incomplete">Onvolledige voorstellen</option></select>
        <select aria-label="Aantal per pagina" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as PageSize); setPage(1); }} className="rounded-xl border border-[#d7cdbf] bg-white px-3 py-2 text-sm">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per pagina</option>)}</select>
      </section>

      {loading && !data ? <div className="rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] p-8 text-center">Laden…</div> : null}
      {!loading && data && data.pagination.totalItems === 0 ? <EmptyReviewState /> : null}
      {data && data.pagination.totalItems > 0 ? (
        <section className="rounded-2xl border border-[#ded5c8] bg-[#fbf8f2]">
          {visibleTransactions.map((item) => <ReviewRow key={item.transactionId} item={item} categories={data.categories} projects={data.projects} transactionTypes={data.transactionTypes} onConfirmed={load} onCreateProject={createProjectOption} onCreateTransactionType={createTransactionTypeOption} onCreateCategory={createCategoryOption} />)}
          {!visibleTransactions.length ? <div className="p-8 text-center text-sm text-[#6f6253]">Geen transacties op deze pagina voldoen aan de filters.</div> : null}
        </section>
      ) : null}

      {pagination ? <nav aria-label="Paginering" className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] p-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm">Pagina {pagination.page} van {pagination.totalPages} · {pagination.totalItems} transacties</span><div className="flex gap-2"><button type="button" disabled={!pagination.hasPreviousPage || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-[#d7cdbf] px-4 py-2 text-sm font-semibold disabled:opacity-40">Vorige</button><button type="button" disabled={!pagination.hasNextPage || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-[#1f5f4a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Volgende</button></div></nav> : null}
    </FinanceAppFrame>
  );
}
