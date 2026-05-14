'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  deactivateEmailRecipient,
  fetchAuditLogs,
  fetchEmailRecipients,
  fetchImportBatches,
  getImportBatchDownloadUrl,
  saveEmailRecipient,
  type AuditLogEntry,
  type EmailRecipient,
  type ImportBatchSummary,
  isClientAdmin,
} from '@/libs/api';
import { useLedger } from '@/context/ledger-context';

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

function SettingCard({ title, body, status }: { title: string; body: string; status: string }) {
  return (
    <article className="rounded-[1.75rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_18px_55px_rgba(87,67,45,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.04em]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#6f6253]">{body}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#edf5ec] px-3 py-1 text-xs font-semibold text-[#1f5f4a]">{status}</span>
      </div>
    </article>
  );
}

const normalizeCategoryLabel = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const isReviewPlaceholderCategory = (category: { id: string; name: string }) => {
  const normalized = normalizeCategoryLabel(category.name);
  return category.id === 'cat-review' || category.id === 'sub-review-needs-category' || normalized === 'review' || normalized === 'needs review' || normalized === 'needs manual categorization';
};

function CategoryOverview() {
  const { categoryTree } = useLedger();
  const mainCategories = useMemo(() => categoryTree.main.filter((category) => !isReviewPlaceholderCategory(category)), [categoryTree.main]);

  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">Categorieën</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Huidige indeling</h3>
        </div>
        <span className="rounded-full bg-[#f5f1ea] px-3 py-1 text-xs font-semibold text-[#7d6d5a]">{mainCategories.length} hoofdcategorieën</span>
      </div>
      {mainCategories.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {mainCategories.map((main) => {
            const children = (categoryTree.byParent[main.id] ?? []).filter((category) => !isReviewPlaceholderCategory(category));
            return (
              <div key={main.id} className="rounded-[1.5rem] border border-[#ded5c8] bg-[#f8f3ec] p-4">
                <p className="font-semibold text-[#251f1a]">{main.name}</p>
                {children.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {children.map((child) => (
                      <span key={child.id} className="rounded-full bg-[#fbf8f2] px-3 py-1 text-xs font-semibold text-[#6f6253]">{child.name}</span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[#7d6d5a]">Geen subcategorieën.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl bg-[#f5f1ea] p-5 text-sm text-[#6f6253]">Nog geen categorieën geladen.</p>
      )}
    </section>
  );
}

function EmailRecipientsPanel() {
  const canManageRecipients = isClientAdmin();
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRecipients = () => {
    fetchEmailRecipients()
      .then((items) => {
        setRecipients(items);
        setError(null);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'E-mailontvangers konden niet worden geladen.');
      });
  };

  useEffect(() => {
    loadRecipients();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageRecipients) {
      setError('Alleen beheerders mogen e-mailontvangers beheren.');
      return;
    }
    setBusy(true);
    try {
      await saveEmailRecipient({ email, name: name || null });
      setEmail('');
      setName('');
      loadRecipients();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'E-mailontvanger kon niet worden opgeslagen.');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: string) => {
    if (!canManageRecipients) {
      setError('Alleen beheerders mogen e-mailontvangers beheren.');
      return;
    }
    setBusy(true);
    try {
      await deactivateEmailRecipient(id);
      loadRecipients();
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : 'E-mailontvanger kon niet worden gedeactiveerd.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <p className="text-sm font-medium text-[#7d6d5a]">E-mailupdates</p>
      <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Ontvangers maandoverzicht</h3>
      <p className="mt-2 text-sm leading-6 text-[#6f6253]">Beheer de mensen die de financiële samenvatting per e-mail mogen ontvangen.</p>
      {!canManageRecipients ? <p className="mt-4 rounded-2xl bg-[#f5f1ea] p-4 text-sm text-[#6f6253]">Je kijkt mee als viewer. Alleen beheerders kunnen ontvangers toevoegen of uitschakelen.</p> : null}

      <form onSubmit={handleSubmit} className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="e-mailadres" className="rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="naam optioneel" className="rounded-2xl border border-[#ded5c8] bg-[#f5f1ea] px-4 py-3 text-sm outline-none focus:border-[#1f5f4a]" />
        <button disabled={busy || !canManageRecipients} className="rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2] disabled:opacity-60">{canManageRecipients ? 'Toevoegen' : 'Alleen beheerder'}</button>
      </form>

      {error ? <p className="mt-4 rounded-2xl bg-[#f7e9e4] p-4 text-sm text-[#7b4b3a]">{error}</p> : null}

      <div className="mt-5 space-y-3">
        {recipients.length ? recipients.map((recipient) => (
          <div key={recipient.id} className="flex flex-col gap-3 rounded-[1.25rem] bg-[#f5f1ea] p-4 text-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-[#251f1a]">{recipient.name || recipient.email}</p>
              <p className="text-xs text-[#7d6d5a]">{recipient.email} · {recipient.isActive ? 'actief' : 'uitgeschakeld'}</p>
            </div>
            {recipient.isActive ? (
              <button type="button" disabled={busy || !canManageRecipients} onClick={() => deactivate(recipient.id)} className="rounded-full border border-[#ded5c8] px-3 py-1 text-xs font-semibold text-[#7b4b3a] disabled:opacity-60">{canManageRecipients ? 'Uitschakelen' : 'Alleen beheerder'}</button>
            ) : null}
          </div>
        )) : <p className="rounded-2xl bg-[#f5f1ea] p-4 text-sm text-[#6f6253]">Nog geen e-mailontvangers toegevoegd.</p>}
      </div>
    </section>
  );
}

const formatImportDate = (value: string | null) => {
  if (!value) return 'Nog niet afgerond';
  return new Date(value).toLocaleString('nl-NL');
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes || bytes <= 0) return 'onbekende grootte';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const shortHash = (value: string | null) => value ? `${value.slice(0, 10)}…` : 'geen hash';

const translateImportStatus = (status: ImportBatchSummary['status']) => {
  switch (status) {
    case 'completed':
      return 'voltooid';
    case 'pending':
      return 'bezig';
    case 'failed':
      return 'mislukt';
    default:
      return status;
  }
};

function ImportHistoryPanel() {
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchImportBatches(10)
      .then((items) => {
        if (!cancelled) {
          setBatches(items);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Importgeschiedenis kon niet worden geladen.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#7d6d5a]">ING-imports</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Laatste importbestanden</h3>
        </div>
        <span className="rounded-full bg-[#edf5ec] px-3 py-1 text-xs font-semibold text-[#1f5f4a]">Download beschikbaar</span>
      </div>
      <p className="mb-5 text-sm leading-6 text-[#6f6253]">
        Deze lijst toont de opgeslagen importmetadata en geeft toegang tot het originele ING-bestand wanneer het vanaf nu is opgeslagen.
      </p>
      {error ? <p className="rounded-2xl bg-[#f7e9e4] p-4 text-sm text-[#7b4b3a]">{error}</p> : null}
      {!error && batches.length ? (
        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.id} className="rounded-[1.25rem] bg-[#f5f1ea] p-4 text-sm text-[#574b3f]">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-[#251f1a]">{batch.filename}</p>
                  <p className="text-xs text-[#7d6d5a]">{formatImportDate(batch.completedAt ?? batch.startedAt)} · {translateImportStatus(batch.status)}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[#fbf8f2] px-3 py-1">{batch.importedRows} nieuw</span>
                  <span className="rounded-full bg-[#fbf8f2] px-3 py-1">{batch.autoCategorizedRows} automatisch</span>
                  <span className="rounded-full bg-[#fbf8f2] px-3 py-1">{batch.reviewRows} te beoordelen</span>
                  <span className="rounded-full bg-[#fbf8f2] px-3 py-1">{batch.duplicateRows} dubbel</span>
                  <span className="rounded-full bg-[#fbf8f2] px-3 py-1">{formatFileSize(batch.fileSizeBytes)}</span>
                  <span className="rounded-full bg-[#fbf8f2] px-3 py-1">hash {shortHash(batch.fileSha256)}</span>
                  {batch.hasOriginalFile ? <a href={getImportBatchDownloadUrl(batch.id)} className="rounded-full bg-[#1f5f4a] px-3 py-1 text-[#fbf8f2]">Download origineel</a> : <span className="rounded-full bg-[#fff7df] px-3 py-1 text-[#7a5512]">geen bestand</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {!error && !batches.length ? <p className="rounded-2xl bg-[#f5f1ea] p-4 text-sm text-[#6f6253]">Nog geen imports gevonden.</p> : null}
    </section>
  );
}

function AuditLogPreview() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAuditLogs(10)
      .then((entries) => {
        if (!cancelled) {
          setLogs(entries);
          setError(null);
        }
      })
      .catch((auditError) => {
        if (!cancelled) {
          setError(auditError instanceof Error ? auditError.message : 'De auditlog kon niet worden geladen.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <p className="text-sm font-medium text-[#7d6d5a]">Auditlog</p>
      <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Laatste wijzigingen</h3>
      {error ? <p className="mt-4 rounded-2xl bg-[#f7e9e4] p-4 text-sm text-[#7b4b3a]">{error}</p> : null}
      {!error && logs.length ? (
        <div className="mt-5 space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-[1.25rem] bg-[#f5f1ea] p-4 text-sm text-[#574b3f]">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <p className="font-semibold text-[#251f1a]">{translateAuditAction(log.action)}</p>
                <p className="text-xs text-[#8a7965]">{new Date(log.createdAt).toLocaleString('nl-NL')}</p>
              </div>
              <p className="mt-1 text-xs text-[#7d6d5a]">
                {log.actorEmail ?? log.actorId ?? 'Onbekende gebruiker'} · {log.entityType}{log.entityId ? ` ${log.entityId.slice(0, 8)}` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {!error && !logs.length ? (
        <p className="mt-4 rounded-2xl bg-[#f5f1ea] p-4 text-sm text-[#6f6253]">Nog geen wijzigingen gelogd.</p>
      ) : null}
    </section>
  );
}

function translateAuditAction(action: string) {
  switch (action) {
    case 'transaction.category.updated':
      return 'Categorie van transactie aangepast';
    case 'categorizationRule.created':
      return 'Categorisatieregel aangemaakt';
    case 'categorizationRule.updated':
      return 'Categorisatieregel aangepast';
    case 'categorizationRule.applied':
      return 'Categorisatieregel toegepast';
    case 'categorizationRule.deleted':
      return 'Categorisatieregel verwijderd';
    case 'ledger.locked':
      return 'Maand vergrendeld';
    case 'ledger.unlocked':
      return 'Maand ontgrendeld';
    case 'openingBalance.created':
      return 'Beginbalans aangemaakt';
    case 'openingBalance.updated':
      return 'Beginbalans aangepast';
    case 'openingBalance.locked':
      return 'Beginbalans vergrendeld';
    case 'emailRecipient.created':
      return 'E-mailontvanger toegevoegd';
    case 'emailRecipient.updated':
      return 'E-mailontvanger aangepast';
    case 'emailRecipient.deactivated':
      return 'E-mailontvanger uitgeschakeld';
    default:
      return action;
  }
}

function GuardrailList() {
  const items = [
    'ING-import is de normale bron van waarheid.',
    'Dubbele transacties worden genegeerd bij import.',
    'Transacties zonder volledige match komen in Te beoordelen.',
    'Handmatige correcties horen niet in de dagelijkse workflow.',
    'Rapporten zijn pas publiceerbaar na handmatige controle.',
  ];

  return (
    <section className="rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-6 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
      <p className="text-sm font-medium text-[#7d6d5a]">Veiligheid</p>
      <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Foolproof regels</h3>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex gap-3 rounded-[1.25rem] bg-[#f5f1ea] p-4 text-sm text-[#574b3f]">
            <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[#1f5f4a] text-center text-xs font-bold leading-5 text-[#fbf8f2]">✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FinanceSettingsPage() {
  const { summary } = useLedger();

  return (
    <AppFrame reviewCount={summary.reviewCount}>
      <header className="mb-6 rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
        <p className="text-sm font-medium text-[#7d6d5a]">Instellingen</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">Beheer zonder rommel</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6253]">Deze pagina toont de instellingen die belangrijk zijn voor de administratie. Gevaarlijke acties blijven bewust buiten de normale workflow.</p>
      </header>

      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SettingCard title="Gebruikers" body="De app blijft privé. Voor nu blijft authenticatie via de huidige provider actief tot de Ory-migratie apart wordt uitgevoerd." status="Voorbereid" />
          <SettingCard title="E-mailupdates" body="Maandelijkse financiële samenvattingen blijven via Resend lopen en zijn versimpeld naar finance-only e-mails." status="Actief" />
          <SettingCard title="Beheermodus" body="Handmatig wijzigen of verwijderen van transacties hoort later achter een aparte veilige beheermodus, niet in het normale dashboard." status="Gepland" />
        </section>

        <CategoryOverview />
        <ImportHistoryPanel />
        <EmailRecipientsPanel />
        <AuditLogPreview />
        <GuardrailList />
      </div>
    </AppFrame>
  );
}
