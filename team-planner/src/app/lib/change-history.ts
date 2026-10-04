import type { Prisma, PrismaClient } from '@prisma/client';

export type Actor = { id?: string; name: string };
export type Target = { kind: 'ABSENCE'; playDayId: string; playerId: string }
  | { kind: 'LINEUP'; playDayId: string; teamId: string };
export type Snapshot = { unavailable: boolean } | { coachName: string | null; players: { playerId: string; sortOrder: number }[] };
export class ChangeError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export function sameSnapshot(a: unknown, b: unknown) {
  // JSONB may reorder object keys. Compare canonical JSON rather than insertion order.
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
export async function lockClub(tx: Prisma.TransactionClient, clubId: string) {
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
}
async function snapshot(tx: Prisma.TransactionClient, clubId: string, target: Target): Promise<Snapshot> {
  const day = await tx.playDay.findFirst({ where: { id: target.playDayId, clubId } });
  if (!day) throw new ChangeError('Speldagen finns inte kvar i klubben.', 404);
  if (target.kind === 'ABSENCE') {
    if (!await tx.player.findFirst({ where: { id: target.playerId, clubId } })) throw new ChangeError('Spelaren finns inte i klubben.', 404);
    return { unavailable: Boolean(await tx.dayAbsence.findUnique({ where: { playDayId_playerId: { playDayId: target.playDayId, playerId: target.playerId } } })) };
  }
  if (!await tx.team.findFirst({ where: { id: target.teamId, clubId } })) throw new ChangeError('Laget finns inte i klubben.', 404);
  const lineup = await tx.lineup.findUnique({ where: { playDayId_teamId: { playDayId: target.playDayId, teamId: target.teamId } }, include: { players: { orderBy: [{ sortOrder: 'asc' }, { playerId: 'asc' }] } } });
  return { coachName: lineup?.coachName ?? null, players: lineup?.players.map(({ playerId, sortOrder }) => ({ playerId, sortOrder })) ?? [] };
}
export async function recordChange<T>(db: PrismaClient, clubId: string, actor: Actor, target: Target,
  summary: string, mutate: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await lockClub(tx, clubId);
    const before = await snapshot(tx, clubId, target);
    const result = await mutate(tx);
    const after = await snapshot(tx, clubId, target);
    if (!sameSnapshot(before, after)) {
      const day = await tx.playDay.findUnique({ where: { id: target.playDayId } });
      const person = target.kind === 'ABSENCE' ? await tx.player.findUnique({ where: { id: target.playerId } }) : null;
      const team = target.kind === 'LINEUP' ? await tx.team.findUnique({ where: { id: target.teamId } }) : null;
      const label = person ? `${person.firstName} ${person.lastName}` : team?.name ?? '';
      await tx.changeLog.create({ data: { clubId, actorId: actor.id, actorName: actor.name, kind: target.kind,
        entityKey: JSON.stringify(target), summary: `${summary}: ${label}, ${day?.dateKey ?? ''}`, before, after } });
    }
    return result;
  }, { timeout: 15_000 });
}
export async function undoChange(db: PrismaClient, clubId: string, id: string, actor: Actor) {
  return db.$transaction(async (tx) => {
    await lockClub(tx, clubId);
    const entry = await tx.changeLog.findFirst({ where: { id, clubId } });
    if (!entry || entry.undoneAt || !['ABSENCE', 'LINEUP'].includes(entry.kind)) throw new ChangeError('Ändringen kan inte ångras.');
    const target = JSON.parse(entry.entityKey) as Target;
    const current = await snapshot(tx, clubId, target);
    if (!sameSnapshot(current, entry.after)) throw new ChangeError('Uppgifterna har ändrats igen. Ångra den senare ändringen först.');
    const before = entry.before as unknown as Snapshot;
    if (target.kind === 'ABSENCE' && 'unavailable' in before) {
      const where = { playDayId_playerId: { playDayId: target.playDayId, playerId: target.playerId } };
      if (before.unavailable) await tx.dayAbsence.upsert({ where, create: where.playDayId_playerId, update: {} });
      else await tx.dayAbsence.deleteMany({ where: where.playDayId_playerId });
    } else if (target.kind === 'LINEUP' && 'players' in before) {
      const count = await tx.player.count({ where: { clubId, id: { in: before.players.map((p) => p.playerId) } } });
      if (count !== before.players.length) throw new ChangeError('En spelare har tagits bort. Uttagningen kan inte återställas.');
      const currentPlayers = 'players' in current ? new Set(current.players.map((p) => p.playerId)) : new Set<string>();
      const restoredIds = before.players.filter((p) => !currentPlayers.has(p.playerId)).map((p) => p.playerId);
      if (restoredIds.length && await tx.dayAbsence.count({ where: { playDayId: target.playDayId, playerId: { in: restoredIds } } })) {
        throw new ChangeError('En spelare som skulle återställas är nu kryssad som frånvarande. Kontrollera frånvaron först.');
      }
      const lineup = await tx.lineup.upsert({ where: { playDayId_teamId: { playDayId: target.playDayId, teamId: target.teamId } },
        create: { clubId, playDayId: target.playDayId, teamId: target.teamId, coachName: before.coachName }, update: { coachName: before.coachName } });
      await tx.lineupPlayer.deleteMany({ where: { lineupId: lineup.id } });
      if (before.players.length) await tx.lineupPlayer.createMany({ data: before.players.map((p) => ({ ...p, lineupId: lineup.id })) });
    } else throw new ChangeError('Historikposten kan inte återställas.');
    await tx.changeLog.update({ where: { id }, data: { undoneAt: new Date(), undoneBy: actor.name } });
  }, { timeout: 15_000 });
}
