import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1ea] px-6 text-[#251f1a]">
      <section className="max-w-md rounded-[2rem] border border-[#ded5c8] bg-[#fbf8f2] p-8 text-center shadow-[0_24px_70px_rgba(87,67,45,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a7965]">Niet gevonden</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Deze pagina bestaat niet.</h1>
        <p className="mt-3 text-sm leading-6 text-[#6f6253]">Ga terug naar het financiële dashboard.</p>
        <Link href="/" className="mt-6 inline-flex rounded-2xl bg-[#1f5f4a] px-5 py-3 text-sm font-semibold text-[#fbf8f2]">
          Naar dashboard
        </Link>
      </section>
    </main>
  );
}
