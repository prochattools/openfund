'use client';

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLedger } from '@/context/ledger-context';
import { isClientAdmin, uploadStatementPackage } from '@/libs/api';

export function UploadCsvButton({ periodKey }: { periodKey: string }) {
  const csvRef = useRef<HTMLInputElement | null>(null);
  const pdfRef = useRef<HTMLInputElement | null>(null);
  const [csv, setCsv] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { refreshLedger } = useLedger();
  const canImport = isClientAdmin();

  const handleImport = async () => {
    if (!canImport) {
      toast.error('Alleen beheerders mogen ING-maandafschriften importeren.');
      return;
    }
    if (!csv && !pdf) {
      toast.error('Selecteer een CSV-bestand, een PDF-bankafschrift of beide.');
      return;
    }

    setBusy(true);
    try {
      const result = await uploadStatementPackage(csv, pdf, periodKey);
      toast.success(result.message ?? 'Bankafschrift is geïmporteerd, gecontroleerd en opgeslagen.', { duration: 6500 });
      await refreshLedger();
      setCsv(null);
      setPdf(null);
      if (csvRef.current) csvRef.current.value = '';
      if (pdfRef.current) pdfRef.current.value = '';
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Het maandafschrift kon niet veilig worden verwerkt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/60 p-4">
      <div>
        <div className="text-sm font-semibold">ING maandafschrift importeren</div>
        <div className="mt-1 text-xs font-semibold text-[#1f5f4a]">Geselecteerde maand: {periodKey}</div>
        <p className="mt-1 max-w-xl text-xs text-black/60">
          De CSV bevat de transacties. Het PDF-bankafschrift bevat de officiële begin- en eindsaldi en controletotalen. Je kunt één bestand nu uploaden en het bijbehorende bestand later, of beide tegelijk. Zodra beide aanwezig zijn worden ze samen gecontroleerd en aan het maandrapport gekoppeld.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          CSV transacties
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            disabled={busy || !canImport}
            className="mt-1 block w-full text-xs"
            onChange={(event) => setCsv(event.target.files?.[0] ?? null)}
          />
          {csv ? <span className="mt-1 block truncate font-normal text-black/60">{csv.name}</span> : null}
        </label>
        <label className="text-xs font-medium">
          PDF bankafschrift
          <input
            ref={pdfRef}
            type="file"
            accept=".pdf,application/pdf"
            disabled={busy || !canImport}
            className="mt-1 block w-full text-xs"
            onChange={(event) => setPdf(event.target.files?.[0] ?? null)}
          />
          {pdf ? <span className="mt-1 block truncate font-normal text-black/60">{pdf.name}</span> : null}
        </label>
      </div>
      <button
        type="button"
        onClick={handleImport}
        className="w-fit rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2] shadow-[0_14px_35px_rgba(31,95,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#174d3b] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy || !canImport || (!csv && !pdf)}
      >
        {!canImport ? 'Alleen beheerder' : busy ? 'Controleren en verwerken…' : 'Bestand(en) verwerken'}
      </button>
    </div>
  );
}
