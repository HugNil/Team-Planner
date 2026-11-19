import type { Prisma } from '@prisma/client';
import { matchBelongsToTeam } from './team-matching';

type Absence = { playerId: string };
type MatchAvailability = {
  homeTeam: string;
  awayTeam: string;
  absences?: Absence[];
  playDay?: { absences: Absence[] } | null;
};

export function getMatchAbsenceConflict(matches: MatchAvailability[], playerIds: string[]): string | null {
  const ids = new Set(playerIds);
  const match = matches.find(match => [...(match.absences ?? []), ...(match.playDay?.absences ?? [])].some(absence => ids.has(absence.playerId)));
  return match ? `Spelaren är kryssad som frånvarande i ${match.homeTeam} - ${match.awayTeam}. Välj en annan match.` : null;
}

// A lineup and its second-match permutation share a roster, including reserves.
// Check every match represented by that roster, not unrelated teams on the same day.
export async function getTeamAbsenceConflict(tx: Prisma.TransactionClient, clubId: string, playDayId: string, teamId: string, playerIds: string[]): Promise<string | null> {
  if (!playerIds.length) return null;
  const [day, team] = await Promise.all([
    tx.playDay.findFirst({ where: { id: playDayId, clubId }, select: { playRoundId: true, absences: { select: { playerId: true } } } }),
    tx.team.findFirst({ where: { id: teamId, clubId } }),
  ]);
  if (!day || !team) return 'Speldagen eller laget finns inte i klubben.';
  if (day.absences.some(a => playerIds.includes(a.playerId))) return 'Spelaren är kryssad som frånvarande den dagen.';
  const matches = await tx.match.findMany({
    where: { clubId, playDay: { playRoundId: day.playRoundId } },
    include: { absences: { select: { playerId: true } }, playDay: { select: { absences: { select: { playerId: true } } } } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  return getMatchAbsenceConflict(matches.filter(match => matchBelongsToTeam(match, team)), playerIds);
}
