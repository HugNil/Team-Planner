import { matchBelongsToTeam } from './team-matching';
import { ChangeError, lockClub, recordChangeInTransaction, recordChange } from './change-history';
import type { PrismaClient } from '@prisma/client';

export function createAdminAbsenceHandler(
  db: PrismaClient,
  requireAdmin: (clubId: string) => Promise<{ user: { id: string; email: string } } | null>,
) {
  return async function PATCH(req: Request) {
    try {
      const body = await req.json();
      const { clubId, playDayId, playRoundId, teamId, playerId, unavailable } = body ?? {};
      if (typeof clubId !== 'string' || !clubId || (teamId !== undefined ? (typeof teamId !== 'string' || !teamId || typeof playRoundId !== 'string' || !playRoundId || playDayId !== undefined) : (typeof playDayId !== 'string' || !playDayId || playRoundId !== undefined))
        || typeof playerId !== 'string' || !playerId || typeof unavailable !== 'boolean') {
        return Response.json({ error: 'Klubb, speldag, spelare och frånvarostatus krävs.' }, { status: 400 });
      }
      const access = await requireAdmin(clubId);
      if (!access) {
        return Response.json({ error: 'Saknar administratörsbehörighet till klubben.' }, { status: 403 });
      }
      if (teamId) {
        await db.$transaction(async tx => {
          await lockClub(tx, clubId);
          const [team, player, days] = await Promise.all([
            tx.team.findFirst({ where: { id: teamId, clubId } }),
            tx.player.findFirst({ where: { id: playerId, clubId } }),
            tx.playDay.findMany({ where: { clubId, playRoundId }, include: { matches: true, absences: true } }),
          ]);
          if (!team || !player || !days.length) throw new ChangeError('Lag, spelare eller omgång finns inte i klubben.', 404);
          const targets = days.flatMap(day => day.matches.filter(match => matchBelongsToTeam(match, team)).map(match => ({ day, match })));
          if (!targets.length) throw new ChangeError('Laget har inga matcher i omgången.', 404);
          if (targets.some(({ day }) => day.absences.some(a => a.playerId === playerId))) {
            throw new ChangeError('Avmarkera spelarens hela speldag först för att ändra enskilda lag.');
          }
          for (const { day, match } of targets) {
            await recordChangeInTransaction(tx, clubId, { id: access.user.id, name: access.user.email },
              { kind: 'ABSENCE', playDayId: day.id, playerId, matchId: match.id },
              `Lagfrånvaro ${unavailable ? 'markerad' : 'avmarkerad'} (${team.name})`, async tx => {
                const where = { matchId: match.id, playerId };
                if (unavailable) await tx.absence.upsert({ where: { matchId_playerId: where }, create: where, update: {} });
                else await tx.absence.deleteMany({ where });
              });
          }
        }, { timeout: 15_000 });
        return Response.json({ ok: true });
      }
      const [day, player] = await Promise.all([
        db.playDay.findFirst({ where: { id: playDayId, clubId }, select: { id: true } }),
        db.player.findFirst({ where: { id: playerId, clubId }, select: { id: true } }),
      ]);
      if (!day || !player) {
        return Response.json({ error: 'Speldagen eller spelaren finns inte i klubben.' }, { status: 404 });
      }

      return await recordChange(db, clubId, { id: access.user.id, name: access.user.email },
        { kind: 'ABSENCE', playDayId, playerId }, unavailable ? 'Frånvaro markerad' : 'Frånvaro avmarkerad', async (tx) => {
          // Only authenticated club admins reach this path; member deadlines do not apply.
          if (unavailable) {
            const absence = await tx.dayAbsence.upsert({
              where: { playDayId_playerId: { playDayId, playerId } },
              create: { playDayId, playerId },
              update: {},
              include: { player: true },
            });
            return Response.json({ absence });
          }
          await tx.dayAbsence.deleteMany({ where: { playDayId, playerId } });
          return Response.json({ absence: null });
      });
    } catch (error) {
      if (error instanceof ChangeError) return Response.json({ error: error.message }, { status: error.status });
      return Response.json({ error: 'Kunde inte spara frånvaron. Försök igen.' }, { status: 500 });
    }
  };
}
