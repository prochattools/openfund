'use client';

import { useCallback, useEffect, useState } from 'react';
import { FinanceAppFrame } from '@/ui/FinanceAppFrame';
import { MerchantKnowledgePreviewPanel } from '@/ui/MerchantKnowledgePreviewPanel';
import {
  fetchMerchantKnowledgeMerchantDetail,
  fetchMerchantKnowledgeMerchants,
  fetchMerchantKnowledgeSummary,
  type MerchantKnowledgeMerchantDetailResponse,
  type MerchantKnowledgeMerchantListItem,
  type MerchantKnowledgeMerchantListResponse,
  type MerchantKnowledgeSummaryResponse,
} from '@/libs/api';
import {
  MERCHANT_KNOWLEDGE_PAGE_SIZES,
  MERCHANT_KNOWLEDGE_STATUS_OPTIONS,
  classifyMerchantKnowledgeError,
  normalizeMerchantKnowledgePageSize,
  normalizeMerchantKnowledgeQuery,
  normalizeMerchantKnowledgeStatus,
  type MerchantKnowledgePageSize,
  type MerchantKnowledgePageState,
} from '@/helpers/merchantKnowledgeAdmin';

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const formatDate = (value: string) => dateFormatter.format(new Date(value));

function StatePanel({ state }: { state: Exclude<MerchantKnowledgePageState, 'ready'> }) {
  const disabled = state === 'disabled';
  return (
    <section role="status" className="rounded-3xl border border-[#ded5c8] bg-[#fbf8f2] p-8 text-center">
      <h2 className="text-2xl font-semibold">{disabled ? 'Merchant Knowledge is uitgeschakeld' : 'Merchant Knowledge is niet beschikbaar'}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-[#6f6253]">
        {disabled
          ? 'De read-only beheerweergave wordt pas beschikbaar na expliciete serveractivatie.'
          : 'Je account of werkruimte kan deze read-only gegevens momenteel niet laden.'}
      </p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7965]">Geen financiële gegevens zijn aangepast.</p>
    </section>
  );
}

function SummaryCards({ summary }: { summary: MerchantKnowledgeSummaryResponse }) {
  const cards = [
    ['Handelaars', summary.counts.merchants],
    ['Aliassen', summary.counts.aliases],
    ['Vingerafdrukken', summary.counts.fingerprints],
    ['Open conflicten', summary.counts.openConflicts],
  ] as const;
  return (
    <section aria-label="Merchant Knowledge samenvatting" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <article key={label} className="rounded-2xl border border-[#ded5c8] bg-[#fbf8f2] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7965]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
        </article>
      ))}
    </section>
  );
}

function DetailPanel({ detail, loading }: { detail: MerchantKnowledgeMerchantDetailResponse | null; loading: boolean }) {
  if (loading) {
    return <aside aria-live="polite" className="rounded-3xl border border-[#ded5c8] bg-[#fbf8f2] p-6">Details laden…</aside>;
  }
  if (!detail?.merchant) {
    return (
      <aside className="rounded-3xl border border-dashed border-[#cfc3b4] bg-[#fbf8f2] p-6 text-sm text-[#6f6253]">
        Selecteer een handelaar om privacyveilige details te bekijken.
      </aside>
    );
  }
  const merchant = detail.merchant;
  const evidence = [...merchant.aliases, ...merchant.fingerprints];
  return (
    <aside aria-label={`Details van ${merchant.canonicalName}`} className="rounded-3xl border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_18px_50px_rgba(87,67,45,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7965]">Read-only detail</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{merchant.canonicalName}</h2>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[#8a7965]">Status</dt><dd className="font-semibold">{merchant.status}</dd></div>
        <div><dt className="text-[#8a7965]">Versie</dt><dd className="font-semibold">{merchant.version}</dd></div>
        <div><dt className="text-[#8a7965]">Aangemaakt</dt><dd>{formatDate(merchant.createdAt)}</dd></div>
        <div><dt className="text-[#8a7965]">Bijgewerkt</dt><dd>{formatDate(merchant.updatedAt)}</dd></div>
      </dl>
      <div className="mt-6">
        <h3 className="font-semibold">Bewijs</h3>
        {evidence.length === 0 ? <p className="mt-2 text-sm text-[#6f6253]">Geen privacyveilige bewijsregels beschikbaar.</p> : (
          <ul className="mt-3 space-y-3">
            {evidence.map((item) => (
              <li key={item.id} className="rounded-2xl bg-[#f2ece3] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{item.signalType}</strong><span>{item.status}</span>
                </div>
                {item.displayValue ? <p className="mt-2 font-mono">{item.displayValue}</p> : <p className="mt-2 text-[#6f6253]">Bronwaarde afgeschermd</p>}
                <p className="mt-2 break-all text-xs text-[#6f6253]">Waarde-hash: {item.valueHash}</p>
                <p className="break-all text-xs text-[#6f6253]">Bewijs-hash: {item.evidenceHash}</p>
                <p className="mt-1 text-xs text-[#6f6253]">Versie: {item.normalizationVersion ?? item.extractionVersion ?? '—'} · {formatDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default function MerchantKnowledgeAdminPage() {
  const [summary, setSummary] = useState<MerchantKnowledgeSummaryResponse | null>(null);
  const [list, setList] = useState<MerchantKnowledgeMerchantListResponse | null>(null);
  const [detail, setDetail] = useState<MerchantKnowledgeMerchantDetailResponse | null>(null);
  const [pageState, setPageState] = useState<MerchantKnowledgePageState>('ready');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MerchantKnowledgePageSize>(25);
  const [status, setStatus] = useState<MerchantKnowledgeMerchantListItem['status'] | ''>('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, listResponse] = await Promise.all([
        fetchMerchantKnowledgeSummary(),
        fetchMerchantKnowledgeMerchants({ page, pageSize, status: status || null, query: query || null }),
      ]);
      setSummary(summaryResponse);
      setList(listResponse);
      setPageState('ready');
      if (listResponse.pagination.totalPages > 0 && page > listResponse.pagination.totalPages) {
        setPage(listResponse.pagination.totalPages);
      }
    } catch (error) {
      setPageState(classifyMerchantKnowledgeError(error instanceof Error ? error.message : 'Onbekende fout'));
      setSummary(null);
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, status]);

  useEffect(() => { void loadPage(); }, [loadPage]);

  const selectMerchant = async (merchant: MerchantKnowledgeMerchantListItem) => {
    setDetailLoading(true);
    try {
      setDetail(await fetchMerchantKnowledgeMerchantDetail(merchant.id));
    } catch {
      setDetail({ readOnly: true, createsTransactionBooking: false, mutatesBankFacts: false, merchant: null });
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAfterAliasDeprecation = async () => {
    await loadPage();
    const selectedMerchantId = detail?.merchant?.id;
    if (!selectedMerchantId) return;
    setDetailLoading(true);
    try {
      setDetail(await fetchMerchantKnowledgeMerchantDetail(selectedMerchantId));
    } catch {
      setDetail({ readOnly: true, createsTransactionBooking: false, mutatesBankFacts: false, merchant: null });
    } finally {
      setDetailLoading(false);
    }
  };

  const applyQuery = () => {
    setPage(1);
    setQuery(normalizeMerchantKnowledgeQuery(queryInput));
  };

  return (
    <FinanceAppFrame reviewCount={0} activeHref="/merchant-knowledge">
      <div className="space-y-5">
        <header className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a7965]">Beheer · read-only</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Merchant Knowledge</h1>
          <p className="mt-3 max-w-3xl text-sm text-[#6f6253]">Inzicht in handelaarsidentiteiten en privacyveilige bewijsmetadata. Deze pagina maakt geen transactieboeking en wijzigt geen bankfeiten.</p>
        </header>

        {!loading && pageState !== 'ready' ? <StatePanel state={pageState} /> : null}
        {loading && !summary ? <section aria-live="polite" className="rounded-3xl border border-[#ded5c8] bg-[#fbf8f2] p-8">Merchant Knowledge laden…</section> : null}

        {pageState === 'ready' && summary && list ? (
          <>
            <SummaryCards summary={summary} />
            <section className="rounded-3xl border border-[#ded5c8] bg-[#fbf8f2] p-5 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px_160px_auto] lg:items-end">
                <label className="text-sm font-medium">Zoeken
                  <input aria-label="Zoek handelaars" value={queryInput} maxLength={100} onChange={(event) => setQueryInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyQuery(); }} className="mt-1 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2" />
                </label>
                <label className="text-sm font-medium">Status
                  <select aria-label="Filter op status" value={status} onChange={(event) => { setStatus(normalizeMerchantKnowledgeStatus(event.target.value)); setPage(1); }} className="mt-1 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2">
                    {MERCHANT_KNOWLEDGE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">Per pagina
                  <select aria-label="Aantal handelaars per pagina" value={pageSize} onChange={(event) => { setPageSize(normalizeMerchantKnowledgePageSize(Number(event.target.value))); setPage(1); }} className="mt-1 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2">
                    {MERCHANT_KNOWLEDGE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <button type="button" onClick={applyQuery} className="rounded-xl bg-[#1f5f4a] px-5 py-2.5 text-sm font-semibold text-white">Zoeken</button>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
              <section aria-label="Handelaarslijst" className="overflow-hidden rounded-3xl border border-[#ded5c8] bg-[#fbf8f2]">
                {list.merchants.length === 0 ? (
                  <div className="p-8 text-center"><h2 className="text-xl font-semibold">Geen handelaars gevonden</h2><p className="mt-2 text-sm text-[#6f6253]">Pas de filters aan of controleer later opnieuw.</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#efe7db] text-xs uppercase tracking-[0.12em] text-[#6f6253]"><tr><th className="px-4 py-3">Handelaar</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Bewijs</th><th className="px-4 py-3"><span className="sr-only">Detail</span></th></tr></thead>
                      <tbody>{list.merchants.map((merchant) => (
                        <tr key={merchant.id} className="border-t border-[#e4dbcf]">
                          <td className="px-4 py-4"><strong>{merchant.canonicalName}</strong><div className="mt-1 text-xs text-[#8a7965]">Bijgewerkt {formatDate(merchant.updatedAt)}</div></td>
                          <td className="px-4 py-4">{merchant.status}</td>
                          <td className="px-4 py-4">{merchant.counts.aliases + merchant.counts.fingerprints}</td>
                          <td className="px-4 py-4 text-right"><button type="button" aria-label={`Bekijk details van ${merchant.canonicalName}`} onClick={() => void selectMerchant(merchant)} className="rounded-lg border border-[#b7aa99] px-3 py-2 font-semibold">Bekijk</button></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                <nav aria-label="Paginering Merchant Knowledge" className="flex flex-col gap-3 border-t border-[#e4dbcf] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm">Pagina {list.pagination.page} van {Math.max(1, list.pagination.totalPages)} · {list.pagination.totalItems} handelaars</span>
                  <div className="flex gap-2"><button type="button" disabled={!list.pagination.hasPreviousPage || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-[#d7cdbf] px-4 py-2 text-sm font-semibold disabled:opacity-40">Vorige</button><button type="button" disabled={!list.pagination.hasNextPage || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-[#1f5f4a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Volgende</button></div>
                </nav>
              </section>
              <DetailPanel detail={detail} loading={detailLoading} />
            </div>
            <MerchantKnowledgePreviewPanel onConfirmed={refreshAfterAliasDeprecation} />
          </>
        ) : null}
      </div>
    </FinanceAppFrame>
  );
}
