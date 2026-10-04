import type { PrismaClient } from '@prisma/client';
import { ChangeError, recordChange, type Actor } from './change-history';
import { getLineupConflict } from './lineup-eligibility';

export function filterCopyPlayers<T extends { playerId: string; sortOrder: number }>(players: T[], absentIds: Set<string>) {
  return { included: players.filter((p) => !absentIds.has(p.playerId)), skipped: players.filter((p) => absentIds.has(p.playerId)) };
}
export async function copyPreviousLineup(db: PrismaClient, clubId: string, playDayId: string, teamId: string, actor: Actor) {
  return recordChange(db, clubId, actor, { kind: 'LINEUP', playDayId, teamId }, 'Föregående uttagning kopierad', async (tx) => {
    const day = await tx.playDay.findFirst({ where: { id: playDayId, clubId }, include: { playRound: true, absences: true } });
    if (!day) throw new ChangeError('Speldagen hittades inte.', 404);
    const existing = await tx.lineup.findUnique({ where: { playDayId_teamId: { playDayId, teamId } }, include: { players: true } });
    if (existing && (existing.players.length || existing.coachName)) throw new ChangeError('Laget har redan en uttagning eller coach. Kopiering görs bara till ett tomt lag.');
    const source = await tx.lineup.findFirst({
      where: { clubId, teamId, playDay: { playRound: { startsOn: { lt: day.playRound.startsOn } } }, OR: [{ players: { some: {} } }, { coachName: { not: null } }] },
      orderBy: [{ playDay: { playRound: { startsOn: 'desc' } } }, { playDay: { date: 'desc' } }],
      include: { players: { include: { player: true }, orderBy: { sortOrder: 'asc' } }, playDay: { include: { playRound: true } } },
    });
    if (!source) throw new ChangeError('Ingen tidigare uttagning hittades för laget.', 404);
    const filtered = filterCopyPlayers(source.players, new Set(day.absences.map((a) => a.playerId)));
    const skipped = filtered.skipped.map((p) => ({ name: `${p.player.firstName} ${p.player.lastName}`, reason: 'Frånvarande på den nya speldagen' }));
    const lineups = await tx.lineup.findMany({ where: { clubId, playDay: { playRoundId: day.playRoundId } }, include: { players: true } });
    const lineup = await tx.lineup.upsert({ where: { playDayId_teamId: { playDayId, teamId } },
      create: { clubId, playDayId, teamId, coachName: source.coachName }, update: { coachName: source.coachName } });
    const target = { teamId, playDayId, players: [] as { playerId: string; sortOrder: number }[] };
    const proposed = [...lineups.filter((l) => l.id !== lineup.id), target];
    for (const player of filtered.included) {
      const conflict = getLineupConflict(proposed, player.playerId, teamId, player.sortOrder, playDayId);
      if (conflict) skipped.push({ name: `${player.player.firstName} ${player.player.lastName}`, reason: conflict });
      else target.players.push({ playerId: player.playerId, sortOrder: player.sortOrder });
    }
    if (target.players.length) await tx.lineupPlayer.createMany({ data: target.players.map((p) => ({ ...p, lineupId: lineup.id })) });
    return { copied: target.players.length, skipped, sourceDate: source.playDay.dateKey,
      lineup: await tx.lineup.findUnique({ where: { id: lineup.id }, include: { team: true, players: { include: { player: true }, orderBy: { sortOrder: 'asc' } } } }) };
  });
}
