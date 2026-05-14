'use client';

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLedger } from '@/context/ledger-context';

type ImportSummaryWithMessage = {
  importedCount: number;
  autoCategorized?: number;
  autoCategorizedCount?: number;
  reviewCount?: number;
  pendingReviewCount?: number;
  duplicateCount?: number;
  errorCount?: number;
  message?: string;
  errors?: Array<{ rowNumber: number; message: string }>;
};

export function UploadCsvButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const { importCsv, refreshLedger } = useLedger();

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusy(true);

    try {
      const summary = (await importCsv(file)) as ImportSummaryWithMessage;
      const message = summary.message ?? buildDutchImportMessage(summary);

      toast.success(message);
      await refreshLedger();

      if (summary.errors && summary.errors.length) {
        console.warn('Import row issues', summary.errors);
        toast((t) => (
          <div className="text-left text-sm">
            <div className="mb-1 font-semibold">Import voltooid met waarschuwingen</div>
            <div className="max-h-32 overflow-y-auto">
              <ul className="list-disc pl-4">
                {summary.errors!.slice(0, 3).map((error) => (
                  <li key={`${error.rowNumber}-${error.message}`}>{`Rij ${error.rowNumber}: ${error.message}`}</li>
                ))}
              </ul>
              {summary.errors.length > 3 ? (
                <div className="mt-2 text-xs opacity-70">{summary.errors.length - 3} extra rijen overgeslagen</div>
              ) : null}
            </div>
          </div>
        ));
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'De import is niet gelukt. Controleer het bestand en probeer het opnieuw.';
      toast.error(message);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2] shadow-[0_14px_35px_rgba(31,95,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#174d3b] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
      >
        {busy ? 'Importeren…' : 'ING-export importeren'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}

const buildDutchImportMessage = (summary: ImportSummaryWithMessage) => {
  const imported = summary.importedCount ?? 0;
  const duplicates = summary.duplicateCount ?? 0;
  const errors = summary.errorCount ?? 0;
  const review = summary.reviewCount ?? summary.pendingReviewCount ?? 0;
  const auto = summary.autoCategorized ?? summary.autoCategorizedCount ?? 0;

  const parts = [
    imported === 1 ? '1 transactie toegevoegd' : `${imported} transacties toegevoegd`,
  ];

  if (auto > 0) {
    parts.push(auto === 1 ? '1 automatisch gecategoriseerd' : `${auto} automatisch gecategoriseerd`);
  }
  if (review > 0) {
    parts.push(review === 1 ? '1 te beoordelen' : `${review} te beoordelen`);
  }
  if (duplicates > 0) {
    parts.push(duplicates === 1 ? '1 dubbele transactie genegeerd' : `${duplicates} dubbele transacties genegeerd`);
  }
  if (errors > 0) {
    parts.push(errors === 1 ? '1 rij overgeslagen' : `${errors} rijen overgeslagen`);
  }

  return `Import voltooid. ${parts.join('. ')}.`;
};
