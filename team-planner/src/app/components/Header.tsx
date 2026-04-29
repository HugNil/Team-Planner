import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-normal text-slate-950">
          Klubbens Bowlingplan
        </Link>
        <a
          href="#omgangar"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
        >
          Omgångar
        </a>
      </nav>
    </header>
  );
}
