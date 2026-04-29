'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Fel e-post eller lösenord.');
      return;
    }

    router.push('/admin');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase text-emerald-700">Admin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Logga in</h1>
        <p className="mt-2 text-sm text-slate-600">Administrera spelare, frånvaro och laguttagningar.</p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <label className="mt-5 block text-sm font-semibold text-slate-900" htmlFor="email">
          E-post
        </label>
        <input
          id="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
        />

        <label className="mt-4 block text-sm font-semibold text-slate-900" htmlFor="password">
          Lösenord
        </label>
        <input
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? 'Loggar in' : 'Logga in'}
        </button>
      </form>
    </main>
  );
}
