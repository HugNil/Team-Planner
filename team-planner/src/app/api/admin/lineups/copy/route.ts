import { requireClubAccess } from '@/app/lib/admin-auth';
import { prisma } from '@/app/lib/prisma';
import { copyPreviousLineup } from '@/app/lib/copy-lineup';
import { ChangeError } from '@/app/lib/change-history';

export async function POST(req: Request) {
  try {
    const { clubId, playDayId, teamId } = await req.json();
    if (![clubId, playDayId, teamId].every((v) => typeof v === 'string' && v)) return Response.json({ error: 'Klubb, speldag och lag krävs.' }, { status: 400 });
    const access = await requireClubAccess(clubId);
    if (!access) return Response.json({ error: 'Saknar behörighet' }, { status: 403 });
    return Response.json(await copyPreviousLineup(prisma, clubId, playDayId, teamId, { id: access.user.id, name: access.user.email }));
  } catch (error) {
    return Response.json({ error: error instanceof ChangeError ? error.message : 'Kunde inte kopiera uttagningen.' }, { status: error instanceof ChangeError ? error.status : 500 });
  }
}
