'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Player = { id: string; firstName: string; lastName: string; nickname: string | null; number: number | null };
type Team = { id: string; name: string; swebowlTeamId: string | null; sortOrder: number };
type Absence = { id: string; playerId: string; player: Player };
type Match = { id: string; homeTeam: string; awayTeam: string; date: string; location: string | null };
type PlayDay = { id: string; date: string; dateKey: string; matches: Match[]; absences: Absence[] };
type PlayRound = { id: string; startsOn: string; endsOn: string; days: PlayDay[] };
type ClubOption = { id: string; name: string; role: 'ADMIN' | 'UK' };
type Overview = {
  clubs: ClubOption[];
  activeClubId: string;
  memberUrl: string;
  club: {
    id: string;
    name: string;
    players: Player[];
    teams: Team[];
    playRounds: PlayRound[];
  };
};
type LineupPlayer = { id: string; playerId: string; sortOrder: number; player: Player };
type Lineup = { id: string; playDayId: string; teamId: string; team: Team; coachName: string | null; players: LineupPlayer[] };
type TeamPlan = { team: Team; playDay: PlayDay | null; matches: Match[]; lineup: Lineup | null };
type PlannerData = { players: Player[]; teams: Team[]; playRound: PlayRound; days: PlayDay[]; lineups: Lineup[]; teamPlans: TeamPlan[] };

const dayFormatter = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

function playerName(player: Player) {
  return `${player.firstName} ${player.lastName}`.trim();
}

function plannerName(player: Player) {
  return player.nickname?.trim() || playerName(player);
}

export default function AdminPage() {
  const { status } = useSession();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [clubId, setClubId] = useState('');
  const [tab, setTab] = useState<'players' | 'absence' | 'planner'>('players');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [playerForm, setPlayerForm] = useState({ firstName: '', lastName: '', nickname: '' });
  const [editingPlayerId, setEditingPlayerId] = useState('');
  const [playerEditForm, setPlayerEditForm] = useState({ firstName: '', lastName: '', nickname: '' });
  const [teamForm, setTeamForm] = useState({ name: '', swebowlTeamId: '' });
  const [editingTeamId, setEditingTeamId] = useState('');
  const [teamEditForm, setTeamEditForm] = useState({ name: '', swebowlTeamId: '' });
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [planner, setPlanner] = useState<PlannerData | null>(null);
  const [selectedPlannerPlayerId, setSelectedPlannerPlayerId] = useState('');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [router, status]);

  async function loadOverview(nextClubId = clubId) {
    const suffix = nextClubId ? `?clubId=${nextClubId}` : '';
    const response = await fetch(`/api/admin/overview${suffix}`);
    const payload = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await signOut({ callbackUrl: '/login', redirect: true });
        return;
      }
      throw new Error(payload.error ?? 'Kunde inte läsa admin');
    }

    setOverview(payload);
    setClubId(payload.activeClubId);
    setSelectedRoundId((current) => current || payload.club.playRounds[0]?.id || '');
  }

  useEffect(() => {
    if (status === 'authenticated') {
      loadOverview().catch((err) => setError(err instanceof Error ? err.message : 'Något gick fel'));
    }
  }, [status]);

  const placedPlayerIds = useMemo(() => new Set(planner?.lineups.flatMap((lineup) => lineup.players.map((item) => item.playerId)) ?? []), [planner]);
  const selectedRoundNumber = useMemo(() => {
    if (!overview || !selectedRoundId) return 1;
    const roundIndex = overview.club.playRounds.findIndex((round) => round.id === selectedRoundId);
    return roundIndex >= 0 ? roundIndex + 1 : 1;
  }, [overview, selectedRoundId]);

  async function refreshAll() {
    await loadOverview(clubId);
    if (selectedRoundId) {
      await loadPlanner(selectedRoundId);
    }
  }

  async function handleAddPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const response = await fetch('/api/admin/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...playerForm, clubId }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'Kunde inte lägga till spelare');
      return;
    }

    setPlayerForm({ firstName: '', lastName: '', nickname: '' });
    setMessage('Spelare tillagd.');
    await refreshAll();
  }

  async function deletePlayer(playerId: string) {
    await fetch(`/api/admin/players?playerId=${playerId}`, { method: 'DELETE' });
    await refreshAll();
  }

  function startEditPlayer(player: Player) {
    setEditingPlayerId(player.id);
    setPlayerEditForm({
      firstName: player.firstName,
      lastName: player.lastName,
      nickname: player.nickname ?? '',
    });
  }

  async function savePlayer(playerId: string) {
    setMessage('');
    setError('');
    const response = await fetch('/api/admin/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, ...playerEditForm }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'Kunde inte spara spelare');
      return;
    }

    setEditingPlayerId('');
    setMessage('Spelare sparad.');
    await refreshAll();
  }

  async function handleAddTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...teamForm, clubId, sortOrder: overview?.club.teams.length ?? 0 }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'Kunde inte lägga till lag');
      return;
    }

    setTeamForm({ name: '', swebowlTeamId: '' });
    setMessage('Lag tillagt.');
    await refreshAll();
  }

  function startEditTeam(team: Team) {
    setEditingTeamId(team.id);
    setTeamEditForm({
      name: team.name,
      swebowlTeamId: team.swebowlTeamId ?? '',
    });
  }

  async function saveTeam(teamId: string) {
    setMessage('');
    setError('');
    const response = await fetch('/api/admin/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, ...teamEditForm }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'Kunde inte spara lag');
      return;
    }

    setEditingTeamId('');
    setMessage('Lag sparat.');
    await refreshAll();
  }

  async function deleteTeam(teamId: string) {
    await fetch(`/api/admin/teams?teamId=${teamId}`, { method: 'DELETE' });
    await refreshAll();
  }

  async function syncSwebowl() {
    setMessage('');
    setError('');
    const response = await fetch('/api/swebowl/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: clubId }),
    });
    const payload = await response.json();
    setMessage(payload.message ?? `Synk klar: ${payload.imported} nya, ${payload.updated} uppdaterade.`);
    await refreshAll();
  }

  async function loadPlanner(playRoundId = selectedRoundId) {
    if (!playRoundId || !clubId) return;
    const response = await fetch(`/api/admin/lineups?clubId=${clubId}&playRoundId=${playRoundId}`);
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'Kunde inte läsa lagplanering');
      return;
    }

    setPlanner(payload);
  }

  function applyLineupUpdate(updatedLineup: Lineup, movedPlayerId?: string) {
    setPlanner((current) => {
      if (!current) {
        return current;
      }

      const cleanLineup = (lineup: Lineup) => ({
        ...lineup,
        players: movedPlayerId ? lineup.players.filter((item) => item.playerId !== movedPlayerId) : lineup.players,
      });
      const lineups = current.lineups
        .map(cleanLineup)
        .filter((lineup) => lineup.id !== updatedLineup.id);

      lineups.push(updatedLineup);

      return {
        ...current,
        lineups,
        teamPlans: current.teamPlans.map((plan) => {
          if (plan.lineup?.id === updatedLineup.id || (plan.team.id === updatedLineup.teamId && plan.playDay?.id === updatedLineup.playDayId)) {
            return { ...plan, lineup: updatedLineup };
          }

          return plan.lineup ? { ...plan, lineup: cleanLineup(plan.lineup) } : plan;
        }),
      };
    });
  }

  function applyPlayerRemove(playerId: string) {
    setPlanner((current) => {
      if (!current) {
        return current;
      }

      const cleanLineup = (lineup: Lineup) => ({
        ...lineup,
        players: lineup.players.filter((item) => item.playerId !== playerId),
      });

      return {
        ...current,
        lineups: current.lineups.map(cleanLineup),
        teamPlans: current.teamPlans.map((plan) => (plan.lineup ? { ...plan, lineup: cleanLineup(plan.lineup) } : plan)),
      };
    });
  }

  function applyOptimisticAssign(playerId: string, teamId: string, playDayId: string, sortOrder: number) {
    setPlanner((current) => {
      if (!current) {
        return current;
      }

      const player = current.players.find((item) => item.id === playerId);
      const plan = current.teamPlans.find((item) => item.team.id === teamId && item.playDay?.id === playDayId);

      if (!player || !plan) {
        return current;
      }

      const baseLineup: Lineup = plan.lineup ?? {
        id: `pending-${playDayId}-${teamId}`,
        playDayId,
        teamId,
        team: plan.team,
        coachName: null,
        players: [],
      };
      const updatedLineup: Lineup = {
        ...baseLineup,
        players: [
          ...baseLineup.players.filter((item) => item.playerId !== playerId && item.sortOrder !== sortOrder),
          {
            id: `pending-${playDayId}-${teamId}-${playerId}`,
            playerId,
            sortOrder,
            player,
          },
        ].sort((a, b) => a.sortOrder - b.sortOrder),
      };
      const cleanLineup = (lineup: Lineup) => ({
        ...lineup,
        players: lineup.players.filter((item) => item.playerId !== playerId),
      });
      const lineups = current.lineups
        .map(cleanLineup)
        .filter((lineup) => lineup.id !== baseLineup.id);

      lineups.push(updatedLineup);

      return {
        ...current,
        lineups,
        teamPlans: current.teamPlans.map((item) => {
          if (item.team.id === teamId && item.playDay?.id === playDayId) {
            return { ...item, lineup: updatedLineup };
          }

          return item.lineup ? { ...item, lineup: cleanLineup(item.lineup) } : item;
        }),
      };
    });
  }

  useEffect(() => {
    if (tab === 'planner' && selectedRoundId) {
      loadPlanner(selectedRoundId);
    }
  }, [tab, selectedRoundId]);

  async function assignPlayer(playerId: string, teamId: string, playDayId: string, sortOrder: number) {
    if (!playerId) return;
    const previousPlanner = planner;
    applyOptimisticAssign(playerId, teamId, playDayId, sortOrder);

    const response = await fetch('/api/admin/lineups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId, playDayId, teamId, playerId, sortOrder, action: 'add' }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setPlanner(previousPlanner);
      setError(payload.error ?? 'Kunde inte placera spelare');
      return;
    }

    setError('');
    setSelectedPlannerPlayerId('');
    if (payload.lineup) {
      applyLineupUpdate(payload.lineup, playerId);
    }
  }

  async function removePlayer(playerId: string, teamId: string, playDayId: string) {
    const previousPlanner = planner;
    applyPlayerRemove(playerId);

    const response = await fetch('/api/admin/lineups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId, playDayId, teamId, playerId, action: 'remove' }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setPlanner(previousPlanner);
      setError(payload.error ?? 'Kunde inte ta bort spelare');
      return;
    }

    setError('');
  }

  async function saveCoach(teamId: string, playDayId: string, coachName: string) {
    const response = await fetch('/api/admin/lineups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId, playDayId, teamId, coachName, action: 'coach' }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'Kunde inte spara coach');
      return;
    }

    setError('');
    if (payload.lineup) {
      applyLineupUpdate(payload.lineup);
    }
  }

  async function copyLineup(team: Team, lineup: Lineup | undefined) {
    const lines = [`Omg ${selectedRoundNumber}`, ''];
    const playerBySlot = new Map((lineup?.players ?? []).map((item) => [item.sortOrder, plannerName(item.player)]));

    for (let index = 0; index < 8; index += 2) {
      const first = playerBySlot.get(index);
      const second = playerBySlot.get(index + 1);

      if (first || second) {
        lines.push(`${first ?? ''}${first && second ? ' - ' : ''}${second ?? ''}`);
      }
    }

    const reserve = playerBySlot.get(8);

    if (reserve) {
      lines.push(`Reserv: ${reserve}`);
    }

    if (lineup?.coachName) {
      lines.push(`Coach: ${lineup.coachName}`);
    }

    await navigator.clipboard.writeText(lines.join('\n'));
    setMessage(`${team.name} kopierat.`);
    setError('');
  }

  if (error && !overview) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase text-red-700">Admin</p>
          <h1 className="mt-2 text-2xl font-bold">Kunde inte öppna admin</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="mt-4 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
            Logga in igen
          </button>
        </div>
      </main>
    );
  }

  if (status === 'loading' || !overview) {
    return <main className="min-h-screen bg-slate-50 p-6 text-slate-700">Laddar admin...</main>;
  }

  const memberUrl = `${origin}${overview.memberUrl}`;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-5 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-emerald-700">Admin</p>
            <h1 className="truncate text-2xl font-bold text-slate-950 sm:text-3xl">{overview.club.name}</h1>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto sm:flex-row">
            <select
              value={clubId}
              onChange={(event) => {
                setClubId(event.target.value);
                loadOverview(event.target.value);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold md:w-auto"
            >
              {overview.clubs.map((club) => (
                <option key={club.id} value={club.id}>{club.name} ({club.role})</option>
              ))}
            </select>
            <button onClick={() => signOut({ callbackUrl: '/' })} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              Logga ut
            </button>
          </div>
        </header>

        {(message || error) && (
          <div className={`mb-4 rounded-md border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            {error || message}
          </div>
        )}

        <nav className="mb-5 flex flex-wrap gap-2">
          {[
            ['players', 'Spelare & lag'],
            ['absence', 'Frånvaro & QR'],
            ['planner', 'TeamPlanner'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === id ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'players' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xl font-bold">Spelare</h2>
              <form onSubmit={handleAddPlayer} className="mt-4 grid gap-2 md:grid-cols-2">
                <input value={playerForm.firstName} onChange={(e) => setPlayerForm({ ...playerForm, firstName: e.target.value })} placeholder="Förnamn" className="rounded-md border border-slate-300 px-3 py-2" />
                <input value={playerForm.lastName} onChange={(e) => setPlayerForm({ ...playerForm, lastName: e.target.value })} placeholder="Efternamn (valfritt)" className="rounded-md border border-slate-300 px-3 py-2" />
                <input value={playerForm.nickname} onChange={(e) => setPlayerForm({ ...playerForm, nickname: e.target.value })} placeholder="Smeknamn" className="rounded-md border border-slate-300 px-3 py-2" />
                <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Lägg till</button>
              </form>
              <div className="mt-4 max-h-96 divide-y divide-slate-100 overflow-y-auto pr-2">
                {overview.club.players.map((player) => (
                  <div key={player.id} className="py-3">
                    {editingPlayerId === player.id ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <input value={playerEditForm.firstName} onChange={(e) => setPlayerEditForm({ ...playerEditForm, firstName: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
                        <input value={playerEditForm.lastName} onChange={(e) => setPlayerEditForm({ ...playerEditForm, lastName: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
                        <input value={playerEditForm.nickname} onChange={(e) => setPlayerEditForm({ ...playerEditForm, nickname: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" placeholder="Smeknamn" />
                        <button type="button" onClick={() => savePlayer(player.id)} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Spara</button>
                        <button type="button" onClick={() => setEditingPlayerId('')} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">Avbryt</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 break-words">{playerName(player)}{player.nickname ? ` (${player.nickname})` : ''}</span>
                        <div className="flex shrink-0 gap-3">
                          <button onClick={() => startEditPlayer(player)} className="text-sm font-semibold text-slate-700">Ändra</button>
                          <button onClick={() => deletePlayer(player.id)} className="text-sm font-semibold text-red-700">Ta bort</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xl font-bold">Lag</h2>
              <form onSubmit={handleAddTeam} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
                <input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="A-lag, F-lag..." className="rounded-md border border-slate-300 px-3 py-2" />
                <input value={teamForm.swebowlTeamId} onChange={(e) => setTeamForm({ ...teamForm, swebowlTeamId: e.target.value })} placeholder="Swebowl ID" className="rounded-md border border-slate-300 px-3 py-2" />
                <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Lägg till</button>
              </form>
              <div className="mt-4 divide-y divide-slate-100">
                {overview.club.teams.map((team) => (
                  <div key={team.id} className="py-3">
                    {editingTeamId === team.id ? (
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                        <input value={teamEditForm.name} onChange={(e) => setTeamEditForm({ ...teamEditForm, name: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
                        <input value={teamEditForm.swebowlTeamId} onChange={(e) => setTeamEditForm({ ...teamEditForm, swebowlTeamId: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
                        <button type="button" onClick={() => saveTeam(team.id)} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Spara</button>
                        <button type="button" onClick={() => setEditingTeamId('')} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">Avbryt</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold">{team.name}</p>
                          <p className="text-sm text-slate-500">Swebowl: {team.swebowlTeamId || '-'}</p>
                        </div>
                        <div className="flex shrink-0 gap-3">
                          <button onClick={() => startEditTeam(team)} className="text-sm font-semibold text-slate-700">Ändra</button>
                          <button onClick={() => deleteTeam(team.id)} className="text-sm font-semibold text-red-700">Ta bort</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'absence' && (
          <div className="grid gap-5 lg:grid-cols-[24rem_1fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xl font-bold">Medlemslänk</h2>
              <input readOnly value={memberUrl} className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <button onClick={() => navigator.clipboard.writeText(memberUrl)} className="mt-3 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Kopiera länk</button>
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                QR-kod kan skapas från den här länken i valfri QR-generator.
              </div>
              <button onClick={syncSwebowl} className="mt-4 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">Synka från Swebowl</button>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xl font-bold">Frånvaro</h2>
              <div className="mt-4 space-y-4">
                {overview.club.playRounds.map((round, index) => (
                  <div key={round.id} className="rounded-md border border-slate-200 p-3">
                    <h3 className="font-bold">Omgång {index + 1}</h3>
                    {round.days.map((day) => (
                      <div key={day.id} className="mt-3 border-t border-slate-100 pt-3">
                        <p className="font-semibold">{dayFormatter.format(new Date(day.date))}</p>
                        <p className="text-sm text-slate-600">{day.matches.length} matcher</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {day.absences.length === 0 ? <span className="text-sm text-slate-500">Ingen frånvaro</span> : day.absences.map((absence) => (
                            <span key={absence.id} className="rounded-md bg-slate-100 px-2 py-1 text-sm">{playerName(absence.player)}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'planner' && (
          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <label className="text-sm font-semibold">Välj speldag</label>
              <select value={selectedRoundId} onChange={(e) => setSelectedRoundId(e.target.value)} className="mt-2 w-full max-w-md rounded-md border border-slate-300 px-3 py-2">
                {overview.club.playRounds.map((round, index) => (
                  <option key={round.id} value={round.id}>Omgång {index + 1}</option>
                ))}
              </select>
            </section>

            {planner && (
              <div className="grid gap-5 xl:grid-cols-[20rem_1fr]">
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <h2 className="text-xl font-bold">Spelarpool</h2>
                    <p className="text-xs font-semibold text-slate-500">Tryck spelare, tryck plats</p>
                  </div>
                  <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1 xl:max-h-none xl:overflow-visible xl:pr-0">
                    {planner.players.map((player) => {
                      const placed = placedPlayerIds.has(player.id);
                      const selected = selectedPlannerPlayerId === player.id;
                      const unavailableDays = planner.days
                        .filter((day) => day.absences.some((absence) => absence.playerId === player.id))
                        .map((day) => dayFormatter.format(new Date(day.date)));
                      const absentAllRound = planner.days.length > 0 && unavailableDays.length === planner.days.length;
                      return (
                        <div
                          key={player.id}
                          draggable={!absentAllRound}
                          onDragStart={(event) => event.dataTransfer.setData('playerId', player.id)}
                          onClick={() => !absentAllRound && setSelectedPlannerPlayerId(selected ? '' : player.id)}
                          className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold ${selected ? 'border-emerald-700 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-100' : absentAllRound ? 'cursor-not-allowed border-red-200 bg-red-50 text-red-800' : placed ? 'border-slate-200 bg-slate-100 text-slate-500' : unavailableDays.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-900'}`}
                        >
                          {plannerName(player)}
                          {absentAllRound ? ' - frånvarande' : unavailableDays.length > 0 ? ` - kan inte ${unavailableDays.join(', ')}` : placed ? ' - placerad' : ''}
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {planner.teamPlans.map((plan) => {
                    const { team, playDay, lineup, matches } = plan;
                    const lineupPlayers = lineup?.players ?? [];
                    const playerBySlot = new Map(lineupPlayers.map((item) => [item.sortOrder, item]));
                    return (
                      <div
                        key={team.id}
                        className="min-h-64 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h2 className="text-xl font-bold">{team.name}</h2>
                            <p className="text-sm text-slate-500">
                              {playDay ? dayFormatter.format(new Date(playDay.date)) : 'Ingen match i omgången'}
                            </p>
                          </div>
                          <button onClick={() => copyLineup(team, lineup ?? undefined)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold sm:w-auto">
                            Kopiera lag
                          </button>
                        </div>

                        <label className="mt-4 block text-sm font-semibold text-slate-900">Coach</label>
                        <input
                          defaultValue={lineup?.coachName ?? ''}
                          disabled={!playDay}
                          onBlur={(event) => playDay && saveCoach(team.id, playDay.id, event.target.value)}
                          placeholder="Namn på coach"
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                        {matches.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {matches.map((match) => (
                              <p key={match.id} className="text-xs text-slate-500">
                                {match.homeTeam} - {match.awayTeam}
                              </p>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 space-y-3">
                          {[0, 2, 4, 6].map((pairStart) => (
                            <div key={pairStart} className="grid grid-cols-2 gap-2 rounded-md bg-emerald-50 p-2">
                              {[pairStart, pairStart + 1].map((slot) => {
                                const item = playerBySlot.get(slot);

                                return (
                                  <div
                                    key={slot}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => playDay && assignPlayer(event.dataTransfer.getData('playerId'), team.id, playDay.id, slot)}
                                    onClick={() => playDay && selectedPlannerPlayerId && assignPlayer(selectedPlannerPlayerId, team.id, playDay.id, slot)}
                                    className={`min-h-14 min-w-0 rounded-md border px-2 py-2 text-sm sm:px-3 ${selectedPlannerPlayerId && !item ? 'cursor-pointer ring-2 ring-emerald-100' : ''} ${item ? 'border-white bg-white font-semibold text-emerald-950 shadow-sm' : 'border-dashed border-emerald-200 bg-emerald-50 text-emerald-700'}`}
                                  >
                                    {item ? (
                                      <div
                                        draggable
                                        onDragStart={(event) => event.dataTransfer.setData('playerId', item.playerId)}
                                        className="flex min-w-0 items-center justify-between gap-2"
                                      >
                                        <span className="min-w-0 truncate">{plannerName(item.player)}</span>
                                        <button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            playDay && removePlayer(item.playerId, team.id, playDay.id);
                                          }}
                                          aria-label={`Ta bort ${plannerName(item.player)}`}
                                          title="Ta bort"
                                          className="grid h-6 w-6 place-items-center rounded-full text-base leading-none text-red-700 hover:bg-red-50"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ) : (
                                      <span>Plats {slot + 1}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                          <div
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => playDay && assignPlayer(event.dataTransfer.getData('playerId'), team.id, playDay.id, 8)}
                            onClick={() => playDay && selectedPlannerPlayerId && assignPlayer(selectedPlannerPlayerId, team.id, playDay.id, 8)}
                            className={`rounded-md border border-amber-200 bg-amber-50 p-2 ${selectedPlannerPlayerId && !playerBySlot.get(8) ? 'cursor-pointer ring-2 ring-amber-100' : ''}`}
                          >
                            <p className="mb-2 text-xs font-semibold uppercase text-amber-800">Reserv</p>
                            {playerBySlot.get(8) ? (
                              <div
                                draggable
                                onDragStart={(event) => event.dataTransfer.setData('playerId', playerBySlot.get(8)!.playerId)}
                                className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-amber-950 shadow-sm"
                              >
                                <span className="min-w-0 truncate">{plannerName(playerBySlot.get(8)!.player)}</span>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    playDay && removePlayer(playerBySlot.get(8)!.playerId, team.id, playDay.id);
                                  }}
                                  aria-label={`Ta bort ${plannerName(playerBySlot.get(8)!.player)}`}
                                  title="Ta bort"
                                  className="grid h-6 w-6 place-items-center rounded-full text-base leading-none text-red-700 hover:bg-red-50"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <div className="rounded-md border border-dashed border-amber-300 px-3 py-2 text-sm text-amber-800">Reservplats</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
