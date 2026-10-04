import { requireClubAccess } from '@/app/lib/admin-auth';
import { prisma } from '@/app/lib/prisma';
import { ChangeError, undoChange } from '@/app/lib/change-history';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const clubId = params.get('clubId') ?? '';
  if (!await requireClubAccess(clubId)) return Response.json({ error: 'Saknar behörighet' }, { status: 403 });
  const cursor = params.get('cursor');
  const kind = params.get('kind');
  const where = {
    clubId,
    ...(kind === 'ABSENCE' || kind === 'LINEUP' || kind === 'SYNC' ? { kind } : {}),
    ...(kind === 'UNDONE' ? { undoneAt: { not: null } } : {}),
  };
  const entries = await prisma.changeLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const visibleEntries = entries.slice(0, 50);
  const entriesWithStatus = await Promise.all(visibleEntries.map(async (entry: (typeof entries)[number]) => {
    if (entry.kind === 'ABSENCE') {
      const target = JSON.parse(entry.entityKey) as { playDayId: string; playerId: string };
      const absence = await prisma.dayAbsence.findUnique({
        where: { playDayId_playerId: { playDayId: target.playDayId, playerId: target.playerId } },
      });
      return { ...entry, currentStatus: absence ? 'Kryssad' : 'Inte kryssad' };
    }

    if (entry.kind === 'LINEUP') {
      const target = JSON.parse(entry.entityKey) as { playDayId: string; teamId: string };
      const lineup = await prisma.lineup.findUnique({
        where: { playDayId_teamId: { playDayId: target.playDayId, teamId: target.teamId } },
        select: { coachName: true, players: { select: { id: true } } },
      });
      return {
        ...entry,
        currentStatus: lineup
          ? `${lineup.players.length} spelare${lineup.coachName ? ', coach angiven' : ', ingen coach'}`
          : 'Ingen uttagning',
      };
    }

    return { ...entry, currentStatus: null };
  }));

  return Response.json({ entries: entriesWithStatus, nextCursor: entries.length > 50 ? entries[49].id : null });
}
export async function POST(req: Request) {
  try {
    const { clubId, id } = await req.json();
    if (typeof clubId !== 'string' || typeof id !== 'string') return Response.json({ error: 'Ogiltig begäran' }, { status: 400 });
    const access = await requireClubAccess(clubId, ['ADMIN']);
    if (!access) return Response.json({ error: 'Saknar behörighet' }, { status: 403 });
    await undoChange(prisma, clubId, id, { id: access.user.id, name: access.user.email });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof ChangeError ? error.message : 'Kunde inte ångra ändringen.' }, { status: error instanceof ChangeError ? error.status : 500 });
  }
}
