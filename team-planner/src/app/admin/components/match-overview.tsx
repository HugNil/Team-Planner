'use client';

import { useState } from 'react';
import { matchBelongsToTeam } from '@/app/lib/team-matching';

type Player = { id: string; firstName: string; lastName: string };
type Absence = { playerId: string; player: Player };
type Match = { id: string; homeTeam: string; awayTeam: string; externalId: string | null; sourceTeamName: string | null; date: string; location: string | null; absences?: Absence[] };
type Round = { id: string; startsOn: string; endsOn: string; swebowlRound: number | null; days: { id: string; matches: Match[]; absences: Absence[] }[] };
type Props = { rounds: Round[]; teams: { id: string; name: string; swebowlTeamId: string | null }[] };
const dateKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' });
const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'short' });
const time = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function MatchOverview({ rounds, teams }: Props) {
  const [chosenRound, setChosenRound] = useState('');
  const today = dateKey.format(new Date());
  const upcoming = [...rounds].sort((a, b) => a.startsOn.localeCompare(b.startsOn)).filter(round =>
    dateKey.format(new Date(Math.max(new Date(round.endsOn).getTime(), ...round.days.flatMap(day => day.matches.map(match => new Date(match.date).getTime()))))) >= today
  ).slice(0, 2);
  const selected = rounds.find(round => round.id === chosenRound);
  const visibleRounds = selected ? [selected] : upcoming;
  return <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold text-slate-950">Matcher & kryss</h2>
      <select aria-label="Visa omgångar" value={selected?.id ?? ''} onChange={event => setChosenRound(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
        <option value="">Två kommande omgångar</option>
        {rounds.map((round, index) => <option key={round.id} value={round.id}>Omgång {round.swebowlRound ?? index + 1} · {date.format(new Date(round.startsOn))}</option>)}
      </select>
    </div>
    {visibleRounds.length ? visibleRounds.map(round => <RoundOverview key={round.id} round={round} teams={teams} roundIndex={rounds.findIndex(item => item.id === round.id)} />)
      : <p className="rounded-lg border border-slate-200 bg-white p-4 text-slate-600">Inga kommande omgångar finns att visa.</p>}
  </section>;
}

function RoundOverview({ round, teams, roundIndex }: { round: Round; teams: Props['teams']; roundIndex: number }) {
  const matches = round.days.flatMap(day => day.matches);
  const groups = teams.map(team => ({ id: team.id, name: team.name, matches: matches.filter(match => matchBelongsToTeam(match, team)) })).filter(group => group.matches.length);
  const unmatched = matches.filter(match => !groups.some(group => group.matches.some(item => item.id === match.id)));
  for (const match of unmatched) groups.push({ id: `match-${match.id}`, name: `${match.homeTeam} – ${match.awayTeam}`, matches: [match] });

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Omgång {round.swebowlRound ?? roundIndex + 1}</h2>
        <p className="mt-1 text-sm text-slate-500">{date.format(new Date(round.startsOn))} – {date.format(new Date(round.endsOn))} · {matches.length} matcher</p>
      </div>

    </div>
    <p className="sr-only">Omgång {round.swebowlRound ?? roundIndex + 1}. Läsöversikt utan redigering av frånvaro.</p>
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {groups.map(group => {
        const relevantDays = round.days.filter(day => day.matches.some(match => group.matches.some(item => item.id === match.id)));
        const absent = [...new Map([...relevantDays.flatMap(day => day.absences), ...group.matches.flatMap(match => match.absences ?? [])].map(absence => [absence.playerId, absence.player])).values()]
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'sv'));
        return <article key={group.id} className="rounded-lg border border-slate-200 bg-white">
          <h3 className="border-b border-slate-100 px-4 py-3 text-base font-semibold">{group.name}</h3>
          <div className="divide-y divide-slate-100 px-4">
            {[...group.matches].sort((a, b) => a.date.localeCompare(b.date)).map(match => <div key={match.id} className="py-3">
              <p className="text-sm font-medium text-slate-950">{match.homeTeam} – {match.awayTeam}</p>
              <p className="mt-1 text-sm text-slate-600">{time.format(new Date(match.date))}</p>
              {match.location && <p className="mt-0.5 text-sm text-slate-500">{match.location}</p>}
            </div>)}
          </div>
          <div className="border-t border-slate-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-slate-700">Kryssade · {absent.length}</h4>
            {absent.length ? <ul className="mt-2 space-y-1 text-sm text-red-800">{absent.map(player => <li key={player.id}>{player.firstName} {player.lastName}</li>)}</ul>
              : <p className="mt-1 text-sm text-slate-500">Ingen är kryssad.</p>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
