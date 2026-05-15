'use client';

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLedger } from '@/context/ledger-context';
import { getImportFeedbackCounts, getImportFeedbackMessage, type ImportSummaryWithMessage } from '@/helpers/import-feedback';
import { isClientAdmin } from '@/libs/api';

export function UploadCsvButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const { importCsv, refreshLedger } = useLedger();
  const canImport = isClientAdmin();

  const handleClick = () => {
    if (!canImport) {
      toast.error('Alleen beheerders mogen ING-exportbestanden importeren.');
      return;
    }
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
      const message = getImportFeedbackMessage(summary);

      toast.success(message, { duration: 6500 });
      await refreshLedger();

      const { imported, duplicates, review, auto } = getImportFeedbackCounts(summary);

      toast((t) => (
        <div className="text-left text-sm">
          <div className="mb-2 font-semibold">Importoverzicht</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span>Nieuw</span><strong>{imported}</strong>
            <span>Automatisch</span><strong>{auto}</strong>
            <span>Te beoordelen</span><strong>{review}</strong>
            <span>Dubbel genegeerd</span><strong>{duplicates}</strong>
          </div>
        </div>
      ), { duration: 6500 });

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
        disabled={busy || !canImport}
      >
        {!canImport ? 'Alleen beheerder' : busy ? 'Importeren…' : 'ING-export importeren'}
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
