'use client';

import { useState } from 'react';
import {
  confirmMerchantAliasDeprecation,
  isClientAdmin,
  previewMerchantKnowledgePlan,
  type MerchantAliasDeprecationConfirmationResponse,
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

export function MerchantKnowledgePreviewPanel({ onConfirmed }: { onConfirmed?: () => Promise<void> | void }) {
  const [action, setAction] = useState<MerchantKnowledgePreviewAction>('MERGE_MERCHANTS');
  const [reason, setReason] = useState('');
  const [requestKey, setRequestKey] = useState('');
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryIds, setSecondaryIds] = useState('');
  const [intent, setIntent] = useState<'SELECT_MERCHANT' | 'ABSTAIN' | 'DISMISS'>('ABSTAIN');
  const [preview, setPreview] = useState<MerchantKnowledgePreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationAcknowledged, setConfirmationAcknowledged] = useState(false);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<MerchantAliasDeprecationConfirmationResponse | null>(null);

  if (!isClientAdmin()) return null;

  const aliasEvidenceRef = preview?.action === 'DEPRECATE_ALIAS'
    ? preview.evidenceRefs.find((item) => item.recordType === 'ALIAS' && item.recordId === primaryId.trim())
    : undefined;

  const submitPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setConfirmationOpen(false);
    setConfirmationAcknowledged(false);
    setConfirmationError(null);
    setConfirmationResult(null);
    try {
      const nextPreview = await previewMerchantKnowledgePlan(buildRequest(action, reason, requestKey, primaryId, secondaryIds, intent));
      setPreview(nextPreview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Planpreview kon niet worden opgebouwd.');
    } finally {
      setLoading(false);
    }
  };

  const submitAliasDeprecationConfirmation = async () => {
    if (!preview || preview.action !== 'DEPRECATE_ALIAS' || preview.blockingErrors.length > 0 || !aliasEvidenceRef || !confirmationAcknowledged) return;
    setConfirmationLoading(true);
    setConfirmationError(null);
    try {
      const result = await confirmMerchantAliasDeprecation(primaryId.trim(), {
        action: 'DEPRECATE_ALIAS',
        planVersion: preview.planVersion,
        planHash: preview.planHash,
        expectedEvidenceHash: aliasEvidenceRef.evidenceHash,
        reason: reason.trim(),
        requestKey: requestKey.trim(),
      });
      setConfirmationResult(result);
      setConfirmationOpen(false);
      setConfirmationAcknowledged(false);
      await onConfirmed?.();
    } catch (caught) {
      setConfirmationError(caught instanceof Error ? caught.message : 'Aliasdeprecatie kon niet worden bevestigd.');
    } finally {
      setConfirmationLoading(false);
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
          <details className="mt-3 rounded-xl border border-[#d8cdbf] bg-white p-3">
            <summary className="cursor-pointer font-semibold">Voor- en voorgestelde nastatus</summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ beforeState: preview.beforeState, afterState: preview.afterState }, null, 2)}</pre>
          </details>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em]">Preview-only · niet opgeslagen · geen uitvoering</p>
          {preview.action === 'DEPRECATE_ALIAS' && preview.blockingErrors.length === 0 && aliasEvidenceRef ? (
            <button type="button" onClick={() => { setConfirmationError(null); setConfirmationOpen(true); }} className="mt-4 rounded-xl bg-[#8f3f2d] px-5 py-2.5 text-sm font-semibold text-white">Open bevestiging voor aliasdeprecatie</button>
          ) : null}
        </div>
      ) : null}
      {confirmationError ? <p role="alert" className="mt-4 rounded-xl bg-[#f6e8e3] p-3 text-sm">{confirmationError}</p> : null}
      {confirmationResult ? (
        <p role="status" className="mt-4 rounded-xl bg-[#e5f0e9] p-3 text-sm">
          {confirmationResult.idempotent ? 'Aliasdeprecatie was al bevestigd; er zijn geen dubbele records gemaakt.' : 'Alias is gedeactiveerd en de beslissing en audit zijn atomair vastgelegd.'}
          {' '}Beslissing: {confirmationResult.decisionId} · Audit: {confirmationResult.auditEventId}
        </p>
      ) : null}
      {confirmationOpen && preview?.action === 'DEPRECATE_ALIAS' ? (
        <dialog open aria-labelledby="alias-deprecation-title" aria-describedby="alias-deprecation-description" aria-busy={confirmationLoading} onCancel={(event) => { event.preventDefault(); if (!confirmationLoading) setConfirmationOpen(false); }} className="fixed inset-0 z-50 m-auto max-h-[90vh] w-[min(92vw,760px)] overflow-auto rounded-3xl border border-[#b9aa98] bg-[#fbf8f2] p-6 shadow-2xl backdrop:bg-black/40">
          <h3 id="alias-deprecation-title" className="text-2xl font-semibold">Alias individueel deprecëren</h3>
          <p id="alias-deprecation-description" className="mt-2 text-sm text-[#6f6253]">Deze bevestiging wijzigt alleen Merchant Knowledge. Zij maakt geen boeking, wijzigt geen bankfeit en herschrijft geen historische transactie, review, suggestie, ledger, periode of rapportage.</p>
          <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
            <dt className="font-semibold">Alias-ID</dt><dd className="break-all">{primaryId.trim()}</dd>
            <dt className="font-semibold">Planversie</dt><dd>{preview.planVersion}</dd>
            <dt className="font-semibold">Plan-hash</dt><dd className="break-all">{preview.planHash}</dd>
            <dt className="font-semibold">Evidence-hash</dt><dd className="break-all">{aliasEvidenceRef?.evidenceHash}</dd>
            <dt className="font-semibold">Reden</dt><dd>{reason.trim()}</dd>
            <dt className="font-semibold">Request key</dt><dd className="break-all">{requestKey.trim()}</dd>
          </dl>
          <details className="mt-4 rounded-xl border border-[#d8cdbf] bg-white p-3">
            <summary className="cursor-pointer font-semibold">Voor- en voorgestelde nastatus</summary>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ beforeState: preview.beforeState, afterState: preview.afterState }, null, 2)}</pre>
          </details>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div><p className="font-semibold">Blokkers</p><p>{preview.blockingErrors.length}</p></div>
            <div><p className="font-semibold">Waarschuwingen</p><p>{preview.warnings.length}</p></div>
            <div><p className="font-semibold">Rollback-records</p><p>{preview.rollbackSteps.length}</p></div>
          </div>
          <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#d8cdbf] bg-white p-3 text-sm">
            <input type="checkbox" aria-label="Bevestig aliasdeprecatie" checked={confirmationAcknowledged} onChange={(event) => setConfirmationAcknowledged(event.target.checked)} className="mt-1" />
            <span>Ik bevestig dat deze individuele actie de alias deprecieert, Merchant Knowledge auditbaar wijzigt en geen financiële boeking of banktransactie verandert.</span>
          </label>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button autoFocus type="button" onClick={() => { if (!confirmationLoading) { setConfirmationOpen(false); setConfirmationAcknowledged(false); } }} disabled={confirmationLoading} className="rounded-xl border border-[#8a7965] px-5 py-2.5 text-sm font-semibold">Annuleren</button>
            <button type="button" onClick={() => void submitAliasDeprecationConfirmation()} disabled={confirmationLoading || !confirmationAcknowledged} className="rounded-xl bg-[#8f3f2d] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{confirmationLoading ? 'Alias deprecëren…' : 'Alias deprecëren'}</button>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
