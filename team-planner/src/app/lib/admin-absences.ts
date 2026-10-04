import { recordChange } from './change-history';
import type { PrismaClient } from '@prisma/client';

export function createAdminAbsenceHandler(
  db: PrismaClient,
  requireAdmin: (clubId: string) => Promise<{ user: { id: string; email: string } } | null>,
) {
  return async function PATCH(req: Request) {
    try {
      const body = await req.json();
      const { clubId, playDayId, playerId, unavailable } = body ?? {};
      if (typeof clubId !== 'string' || !clubId || typeof playDayId !== 'string' || !playDayId
        || typeof playerId !== 'string' || !playerId || typeof unavailable !== 'boolean') {
        return Response.json({ error: 'Klubb, speldag, spelare och frånvarostatus krävs.' }, { status: 400 });
      }
      const access = await requireAdmin(clubId);
      if (!access) {
        return Response.json({ error: 'Saknar administratörsbehörighet till klubben.' }, { status: 403 });
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
    } catch {
      return Response.json({ error: 'Kunde inte spara frånvaron. Försök igen.' }, { status: 500 });
    }
  };
}
