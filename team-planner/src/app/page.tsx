'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number | null;
};

type Absence = {
  id: string;
  playerId: string;
  player: Player;
};

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  location: string | null;
  absences: Absence[];
};

type PlayDay = {
  id: string;
  date: string;
  dateKey: string;
  matches: Match[];
  absences: Absence[];
};

type PlayRound = {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  days: PlayDay[];
};

type BoardData = {
  club: {
    id: string;
    name: string;
  };
  rounds: PlayRound[];
  matches: Match[];
  players: Player[];
};

const formatter = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const roundFormatter = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
});

function playerName(player: Player) {
  return `${player.firstName} ${player.lastName}`.trim();
}

function getAbsenceDeadline(startsOn: string) {
  const start = new Date(startsOn);
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() - 6);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

function isDeadlinePassed(startsOn: string) {
  return Date.now() > getAbsenceDeadline(startsOn).getTime();
}

export default function Home() {
  const [clubCode, setClubCode] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [data, setData] = useState<BoardData | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');

  const selectedPlayer = useMemo(
    () => data?.players.find((player) => player.id === selectedPlayerId) ?? null,
    [data?.players, selectedPlayerId],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('klubb') ?? params.get('club') ?? params.get('kod') ?? params.get('code');

    if (!codeFromUrl) {
      return;
    }

    const normalizedCode = codeFromUrl.trim();
    setClubCode(normalizedCode);
    setActiveCode(normalizedCode);
    setLoading(true);
    setError('');

    loadBoard(normalizedCode)
      .then(() => {
        window.localStorage.setItem('bowlingClubCode', normalizedCode);
      })
      .catch((err) => {
        setData(null);
        setActiveCode('');
        setError(err instanceof Error ? err.message : 'Något gick fel');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function loadBoard(code: string) {
    const response = await fetch(`/api/member-board?code=${encodeURIComponent(code)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? 'Kunde inte öppna medlemssidan');
    }

    setData(payload);
    setSelectedPlayerId((current) =>
      current && payload.players.some((player: Player) => player.id === current) ? current : '',
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedCode = clubCode.trim();
      await loadBoard(normalizedCode);
      setActiveCode(normalizedCode);
      window.localStorage.setItem('bowlingClubCode', normalizedCode);
    } catch (err) {
      setData(null);
      setActiveCode('');
      setError(err instanceof Error ? err.message : 'Något gick fel');
    } finally {
      setLoading(false);
    }
  }

  async function toggleAbsence(playDayId: string, playerId: string, unavailable: boolean) {
    if (!data || !activeCode) {
      return;
    }

    const savingId = `${playDayId}-${playerId}`;
    setSavingKey(savingId);
    setError('');

    try {
      const response = await fetch('/api/member-board', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCode,
          playDayId,
          playerId,
          unavailable,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Kunde inte spara ändringen');
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          rounds: current.rounds.map((round) => ({
            ...round,
            days: round.days.map((day) => {
              if (day.id !== playDayId) {
                return day;
              }

              const absences = unavailable
                ? [
                    ...day.absences.filter((absence) => absence.playerId !== playerId),
                    payload.absence,
                  ].filter(Boolean)
                : day.absences.filter((absence) => absence.playerId !== playerId);

              return { ...day, absences };
            }),
          })),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel');
    } finally {
      setSavingKey('');
    }
  }

  async function syncSwebowl() {
    if (!activeCode) {
      return;
    }

    setSyncing(true);
    setSyncMessage('');
    setError('');

    try {
      const response = await fetch('/api/swebowl/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCode,
          clubName: 'BK Allön',
          seasonId: 2025,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Kunde inte synka från Swebowl');
      }

      setSyncMessage(payload.message ?? `Synkat från Swebowl: ${payload.imported} nya, ${payload.updated} uppdaterade.`);
      await loadBoard(activeCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel');
    } finally {
      setSyncing(false);
    }
  }

  function useSavedCode() {
    const savedCode = window.localStorage.getItem('bowlingClubCode');

    if (savedCode) {
      setClubCode(savedCode);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section id="omgangar" className={data ? 'mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8' : 'min-h-screen px-4 py-6 sm:px-6'}>
        {data && (
          <div className="mb-5 flex items-center justify-between gap-3">
            <a
              href="/"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950"
            >
              ← Hem
            </a>
            <p className="text-sm font-semibold text-slate-500">
              {data.rounds.length} omgångar
            </p>
          </div>
        )}

        {error && (
          <div className="mx-auto mb-5 max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        {!data ? (
          <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
            <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_24rem]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
                  Privat medlemssida
                </p>
                <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl">
                  Kryssa i dagarna du inte kan spela.
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                  Öppna via klubbens länk eller QR-kod. Ingen inloggning behövs.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">Öppna krysslistan</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Klubb-ID:t finns i länken eller QR-koden som klubben delar.
                </p>

                <label htmlFor="clubCode" className="mt-5 block text-sm font-semibold text-slate-900">
                  Klubb-ID
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="clubCode"
                    value={clubCode}
                    onChange={(event) => setClubCode(event.target.value)}
                    onFocus={useSavedCode}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Klubb-ID"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={loading || clubCode.trim().length === 0}
                    className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {loading ? 'Öppnar' : 'Öppna'}
                  </button>
                </div>
              </form>
            </div>

            <footer className="py-4 text-center text-xs font-semibold text-slate-500">
              <a
                href="https://hugo-nilsson.se"
                target="_blank"
                rel="noreferrer"
                className="text-slate-700 underline-offset-4 hover:text-emerald-700 hover:underline"
              >
                Hugo Nilsson
              </a>
            </footer>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{data.club.name}</p>
                  <h1 className="mt-1 text-3xl font-bold text-slate-950">Krysslista</h1>
                </div>

                <div className="w-full sm:max-w-xs">
                  <label htmlFor="player" className="block text-sm font-semibold text-slate-900">
                    Spelare
                  </label>
                  <select
                    id="player"
                    value={selectedPlayerId}
                    onChange={(event) => setSelectedPlayerId(event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Välj spelare</option>
                    {data.players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {playerName(player)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950">
                {selectedPlayer ? `Kryssa i de dagar ${playerName(selectedPlayer)} inte kan spela.` : 'Välj spelare först.'}
              </div>
            </section>

            <div className="space-y-4">
              {data.rounds.map((round, roundIndex) => {
                const startsOn = new Date(round.startsOn);
                const endsOn = new Date(round.endsOn);
                const deadline = getAbsenceDeadline(round.startsOn);
                const locked = isDeadlinePassed(round.startsOn);

                return (
                  <article key={round.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-white px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                      <h2 className="text-xl font-bold text-slate-950">
                        Omgång {roundIndex + 1}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {roundFormatter.format(startsOn)} - {roundFormatter.format(endsOn)}
                      </p>
                        </div>
                        <div className={`rounded-md px-3 py-2 text-sm font-semibold ${locked ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>
                          {locked ? 'Deadline passerad - kontakta UK direkt' : `Sista dag: ${dayFormatter.format(deadline)}`}
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {round.days.map((day) => {
                        const selectedIsAbsent = day.absences.some((absence) => absence.playerId === selectedPlayerId);
                        const saving = savingKey === `${day.id}-${selectedPlayerId}`;
                        const disabled = !selectedPlayerId || saving || locked;

                        return (
                          <section key={day.id} className={selectedIsAbsent ? 'bg-emerald-50/70' : 'bg-white'}>
                            <label className={`flex cursor-pointer gap-3 px-4 py-4 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selectedIsAbsent}
                                disabled={disabled}
                                onChange={(event) => toggleAbsence(day.id, selectedPlayerId, event.target.checked)}
                                className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-emerald-700"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                  <h3 className="text-lg font-bold text-slate-950">
                                    {dayFormatter.format(new Date(day.date))}
                                  </h3>
                                  <span className="text-sm font-semibold text-slate-500">
                                    {locked ? 'Låst' : saving ? 'Sparar' : selectedIsAbsent ? 'Ikryssad' : 'Ej ikryssad'}
                                  </span>
                                </div>

                                <p className="mt-1 text-sm font-medium text-slate-700">
                                  Kan inte spela den dagen
                                </p>

                                <div className="mt-3 space-y-1">
                                  {day.matches.map((match) => (
                                    <p key={match.id} className="text-sm text-slate-600">
                                      {formatter.format(new Date(match.date))}: {match.homeTeam} - {match.awayTeam}
                                      {match.location ? `, ${match.location}` : ''}
                                    </p>
                                  ))}
                                </div>

                                <div className="mt-3">
                                  <p className="text-sm font-semibold text-slate-700">
                                    {day.absences.length} kan inte
                                  </p>
                                  {day.absences.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {day.absences.map((absence) => (
                                        <span key={absence.id} className="rounded-md bg-white px-2 py-1 text-sm text-slate-700 ring-1 ring-slate-200">
                                          {playerName(absence.player)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </label>
                          </section>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
