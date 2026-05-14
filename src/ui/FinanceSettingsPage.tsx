'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchAuditLogs, type AuditLogEntry } from '@/libs/api';
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

function CategoryOverview() {
  const { categoryTree } = useLedger();
  const mainCategories = useMemo(() => categoryTree.main.filter((category) => category.id !== 'cat-review'), [categoryTree.main]);

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
            const children = categoryTree.byParent[main.id] ?? [];
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
        <AuditLogPreview />
        <GuardrailList />
      </div>
    </AppFrame>
  );
}
