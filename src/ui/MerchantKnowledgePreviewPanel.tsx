'use client';

import { useState } from 'react';
import {
  isClientAdmin,
  previewMerchantKnowledgePlan,
  type MerchantKnowledgePreviewAction,
  type MerchantKnowledgePreviewRequest,
  type MerchantKnowledgePreviewResponse,
} from '@/libs/api';

const ACTIONS: Array<{ value: MerchantKnowledgePreviewAction; label: string }> = [
  { value: 'MERGE_MERCHANTS', label: 'Handelaars samenvoegen' },
  { value: 'SPLIT_MERCHANT', label: 'Handelaar splitsen' },
  { value: 'RESOLVE_CONFLICT', label: 'Conflict oplossen' },
  { value: 'REASSIGN_KNOWLEDGE', label: 'Kennis opnieuw toewijzen' },
  { value: 'DEPRECATE_ALIAS', label: 'Alias verouderen' },
  { value: 'DEPRECATE_MERCHANT', label: 'Handelaar verouderen' },
];

const parseIds = (value: string) => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].sort();

const buildRequest = (
  action: MerchantKnowledgePreviewAction,
  reason: string,
  requestKey: string,
  primaryId: string,
  secondaryIds: string,
  intent: 'SELECT_MERCHANT' | 'ABSTAIN' | 'DISMISS',
): MerchantKnowledgePreviewRequest => {
  const ids = parseIds(secondaryIds);
  const common = { action, reason: reason.trim().slice(0, 500), requestKey: requestKey.trim().slice(0, 80) };
  if (action === 'MERGE_MERCHANTS') return { ...common, targetMerchantId: primaryId.trim(), sourceMerchantIds: ids };
  if (action === 'SPLIT_MERCHANT') return { ...common, sourceMerchantId: primaryId.trim(), plannedMerchantIds: ids, assignments: [] };
  if (action === 'RESOLVE_CONFLICT') return { ...common, conflictId: primaryId.trim(), intent, selectedMerchantId: intent === 'SELECT_MERCHANT' ? ids[0] : undefined };
  if (action === 'REASSIGN_KNOWLEDGE') return { ...common, targetMerchantId: primaryId.trim(), affectedAliasIds: ids };
  if (action === 'DEPRECATE_ALIAS') return { ...common, aliasId: primaryId.trim() };
  return { ...common, merchantId: primaryId.trim() };
};

export function MerchantKnowledgePreviewPanel() {
  const [action, setAction] = useState<MerchantKnowledgePreviewAction>('MERGE_MERCHANTS');
  const [reason, setReason] = useState('');
  const [requestKey, setRequestKey] = useState('');
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryIds, setSecondaryIds] = useState('');
  const [intent, setIntent] = useState<'SELECT_MERCHANT' | 'ABSTAIN' | 'DISMISS'>('ABSTAIN');
  const [preview, setPreview] = useState<MerchantKnowledgePreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isClientAdmin()) return null;

  const submitPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await previewMerchantKnowledgePlan(buildRequest(action, reason, requestKey, primaryId, secondaryIds, intent)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Planpreview kon niet worden opgebouwd.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="merchant-preview-title" className="rounded-3xl border border-[#ded5c8] bg-[#fbf8f2] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7965]">Administrator · preview-only</p>
      <h2 id="merchant-preview-title" className="mt-2 text-2xl font-semibold">Planpreview</h2>
      <p className="mt-2 text-sm text-[#6f6253]">Bouw een deterministisch plan zonder uitvoering, opslag, transactieboeking of wijziging van bankfeiten.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">Actie
          <select aria-label="Previewactie" value={action} onChange={(event) => setAction(event.target.value as MerchantKnowledgePreviewAction)} className="mt-1 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2">
            {ACTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Primair entiteits-ID
          <input aria-label="Primair entiteits-ID" value={primaryId} onChange={(event) => setPrimaryId(event.target.value)} className="mt-1 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2" />
        </label>
        <label className="text-sm font-medium">Gerelateerde ID's, kommagescheiden
          <input aria-label="Gerelateerde entiteits-ID's" value={secondaryIds} onChange={(event) => setSecondaryIds(event.target.value)} className="mt-1 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2" />
        </label>
        <label className="text-sm font-medium">Conflictintentie
          <select aria-label="Conflictintentie" value={intent} onChange={(event) => setIntent(event.target.value as typeof intent)} className="mt-1 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2">
            <option value="ABSTAIN">Onbeslist</option><option value="SELECT_MERCHANT">Selecteer handelaar</option><option value="DISMISS">Afwijzen</option>
          </select>
        </label>
        <label className="text-sm font-medium md:col-span-2">Reden
          <textarea aria-label="Reden voor planpreview" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2" />
        </label>
        <label className="text-sm font-medium md:col-span-2">Request key
          <input aria-label="Request key voor planpreview" minLength={8} maxLength={80} value={requestKey} onChange={(event) => setRequestKey(event.target.value)} className="mt-1 w-full rounded-xl border border-[#cfc3b4] bg-white px-3 py-2" />
        </label>
      </div>
      <button type="button" onClick={() => void submitPreview()} disabled={loading} className="mt-4 rounded-xl bg-[#1f5f4a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Preview laden…' : 'Bouw planpreview'}</button>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-[#f6e8e3] p-3 text-sm">{error}</p> : null}
      {preview ? (
        <div aria-live="polite" className="mt-5 rounded-2xl bg-[#f2ece3] p-5 text-sm">
          <p className="font-semibold">Niet-uitvoerend plan · {preview.action}</p>
          <p className="mt-2 break-all">Plan-hash: {preview.planHash}</p>
          <p>Planversie: {preview.planVersion}</p>
          <p className="mt-3 font-semibold">Betrokken entiteiten</p>
          <ul className="list-inside list-disc">{preview.affectedEntityIds.map((id) => <li key={id}>{id}</li>)}</ul>
          <p className="mt-3 font-semibold">Blokkerende fouten</p>
          <ul className="list-inside list-disc">{preview.blockingErrors.length ? preview.blockingErrors.map((item) => <li key={`${item.code}:${item.message}`}><strong>{item.code}</strong>: {item.message}</li>) : <li>Geen</li>}</ul>
          <p className="mt-3 font-semibold">Waarschuwingen</p>
          <ul className="list-inside list-disc">{preview.warnings.length ? preview.warnings.map((item) => <li key={item}>{item}</li>) : <li>Geen</li>}</ul>
          <p className="mt-3 font-semibold">Rollback-metadata</p>
          <ol className="list-inside list-decimal">{preview.rollbackSteps.length ? preview.rollbackSteps.map((item) => <li key={`${item.recordType}:${item.recordId}`}>{item.recordType} {item.recordId} · {Object.keys(item.restore).length} herstelvelden</li>) : <li>Geen</li>}</ol>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em]">Preview-only · niet opgeslagen · geen uitvoering</p>
        </div>
      ) : null}
    </section>
  );
}
