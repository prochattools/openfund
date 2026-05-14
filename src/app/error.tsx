'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1ea] px-6 text-[#251f1a]">
      <section className="max-w-md rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-8 text-center shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a7965]">Er ging iets mis</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">De pagina kon niet worden geladen.</h1>
        <p className="mt-3 text-sm leading-6 text-[#6f6253]">Probeer het opnieuw. Als dit blijft gebeuren, controleer dan de import of serverlog.</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2]">
          Opnieuw proberen
        </button>
      </section>
    </main>
  );
}
