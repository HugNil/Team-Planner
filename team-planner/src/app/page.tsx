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
  teamGroups: { teamId: string; name: string; matches: Match[] }[];
  id: string;
  title: string;
  swebowlRound: number | null;
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

function teamLabel(name: string) {
  const shortName = name.match(/(?:^|\s)(A|F1|F2)(?:-lag)?$/i)?.[1];
  return shortName ? `${shortName.toUpperCase()}-lag` : name;
}

const swedishDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' });

function playerName(player: Player) {
  return `${player.firstName} ${player.lastName}`.trim();
}

function getAbsenceDeadline(startsOn: string) {
  const start = new Date(startsOn);
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() - 7);
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
  const [collapsedRounds, setCollapsedRounds] = useState<Record<string, boolean>>({});
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

  async function toggleAbsence(target: { playRoundId?: string; playDayId?: string; teamId?: string }, unavailable: boolean) {
    if (!data || !activeCode || savingKey || !selectedPlayerId) return;
    setSavingKey(target.teamId ?? target.playRoundId ?? target.playDayId ?? '');
    setError('');
    try {
      const response = await fetch('/api/member-board', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeCode, playerId: selectedPlayerId, ...target, unavailable }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Kunde inte spara ändringen');
      await loadBoard(activeCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel');
    } finally { setSavingKey(''); }
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
            <p className="shrink-0 text-sm font-semibold text-slate-500">
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
                  Kryssa i när du inte kan spela.
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
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
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
                {selectedPlayer ? `Kryssa hela omgången eller de lag ${playerName(selectedPlayer)} inte kan spela för. Ett lagkryss gäller alla lagets matcher i omgången, även dubbelmatcher.` : 'Välj spelare först.'}
              </div>
            </section>

            <div className="space-y-4">
              {data.rounds.map((round, roundIndex) => {
                const startsOn = new Date(round.startsOn);
                const endsOn = new Date(round.endsOn);
                const deadline = getAbsenceDeadline(round.startsOn);
                const locked = isDeadlinePassed(round.startsOn);
                const lastMatchDate = Math.max(endsOn.getTime(), ...round.days.flatMap(day => day.matches.map(match => new Date(match.date).getTime())));
                const finished = swedishDate.format(new Date(lastMatchDate)) < swedishDate.format(new Date());
                const collapsed = collapsedRounds[round.id] ?? finished;
                const wholeRoundAbsent = round.days.length > 0 && round.days.every(day => day.absences.some(a => a.playerId === selectedPlayerId))
                  || round.teamGroups.length > 0 && round.teamGroups.every(group =>
                    group.matches.some(match => match.absences?.some(a => a.playerId === selectedPlayerId))
                    || round.days.some(day => day.matches.some(match => group.matches.some(item => item.id === match.id)) && day.absences.some(a => a.playerId === selectedPlayerId))
                  );

                return (
                  <article key={round.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <button type="button" aria-expanded={!collapsed} aria-controls={`round-${round.id}`}
                      onClick={() => setCollapsedRounds(current => ({ ...current, [round.id]: !collapsed }))}
                      className="block w-full border-b border-slate-100 bg-white px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <div>
                      <span className="flex items-center gap-2 text-base font-semibold text-slate-950">
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}>
                          <path d="m9 5 7 7-7 7" />
                        </svg>
                        Omgång {round.swebowlRound ?? roundIndex + 1}
                      </span>
                      <p className="mt-1 pl-7 text-sm text-slate-600">
                        {roundFormatter.format(startsOn)} - {roundFormatter.format(endsOn)}
                      </p>
                        </div>
                        <div className={`pl-7 text-sm sm:pl-0 ${locked && !finished ? 'text-amber-700' : 'text-slate-500'}`}>
                          {finished ? 'Avslutad omgång' : locked ? 'Deadline passerad - kontakta UK direkt' : `Sista dag: ${dayFormatter.format(deadline)}`}
                        </div>
                      </div>
                    </button>

                    <div id={`round-${round.id}`} hidden={collapsed}>
                    <label className="mx-3 my-3 flex cursor-pointer items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-950 transition-colors hover:bg-slate-50 has-[:disabled]:cursor-default">
                      <input type="checkbox" className="h-5 w-5 shrink-0 accent-emerald-700"
                        checked={wholeRoundAbsent}
                        disabled={!selectedPlayerId || Boolean(savingKey) || locked}
                        onChange={event => toggleAbsence({ playRoundId: round.id }, event.target.checked)} />
                      <span>Kan inte spela hela omgången</span>
                      {savingKey === round.id && <span className="text-sm text-slate-500">Sparar…</span>}
                    </label>

                    <div className="divide-y divide-slate-100">
                      {round.teamGroups.map(group => {
                        const relevantDays = round.days.filter(day => day.matches.some(match => group.matches.some(item => item.id === match.id)));
                        const dayAbsent = relevantDays.some(day => day.absences.some(a => a.playerId === selectedPlayerId));
                        const absences = [...new Map([...relevantDays.flatMap(day => day.absences), ...group.matches.flatMap(match => match.absences ?? [])].map(a => [a.playerId, a])).values()];
                        const checked = absences.some(a => a.playerId === selectedPlayerId);
                        return <section key={group.teamId} className={`px-4 py-3.5 ${checked ? 'bg-emerald-50/30' : ''}`}>
                          <label className="flex items-start gap-3">
                            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-emerald-700"
                              checked={checked} disabled={!selectedPlayerId || Boolean(savingKey) || locked || dayAbsent}
                              onChange={event => toggleAbsence({ teamId: group.teamId, playRoundId: round.id }, event.target.checked)} />
                            <span className="text-sm text-slate-700">
                              <span className="block text-base font-semibold">{teamLabel(group.name)}</span>
                              {group.matches.map(match => <span key={match.id} className="mt-1 block text-sm leading-6 text-slate-700">
                                {formatter.format(new Date(match.date))}: {match.homeTeam} - {match.awayTeam}{match.location ? `, ${match.location}` : ''}
                              </span>)}
                              {savingKey === group.teamId && <span className="block">Sparar…</span>}
                            </span>
                          </label>
                          {absences.length > 0 && <details className="mt-2 pl-8 text-sm text-slate-600">
                            <summary className="cursor-pointer">{absences.length} kan inte</summary>
                            <p className="mt-1 leading-5">{absences.map(a => playerName(a.player)).join(', ')}</p>
                          </details>}
                        </section>;
                      })}
                      {!wholeRoundAbsent && round.days.filter(day => day.absences.some(a => a.playerId === selectedPlayerId)).map(day => (
                        <div key={day.id} className="px-4 py-2">
                          <button type="button" disabled={locked || Boolean(savingKey)}
                            onClick={() => toggleAbsence({ playDayId: day.id }, false)}
                            className="text-sm font-semibold text-emerald-800 underline disabled:opacity-50">
                            Avmarkera hela dagen: {dayFormatter.format(new Date(day.date))}
                          </button>
                        </div>
                      ))}
                    </div>
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
