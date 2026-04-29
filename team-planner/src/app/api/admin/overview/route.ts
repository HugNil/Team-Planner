import { NextResponse } from 'next/server';
import { getAdminSession, requireClubAccess } from '@/app/lib/admin-auth';
import { prisma } from '@/app/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedClubId = searchParams.get('clubId') ?? session.clubs[0]?.id;

    if (!requestedClubId) {
      return NextResponse.json({ error: 'Ingen klubb kopplad till admin' }, { status: 403 });
    }

    const access = await requireClubAccess(requestedClubId);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet till klubben' }, { status: 403 });
    }

    const club = await prisma.club.findUnique({
      where: { id: requestedClubId },
      include: {
        players: { orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] },
        teams: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
        playRounds: {
          include: {
            days: {
              include: {
                matches: { orderBy: { date: 'asc' } },
                absences: { include: { player: true } },
              },
              orderBy: { date: 'asc' },
            },
          },
          orderBy: { startsOn: 'asc' },
        },
      },
    });

    if (!club) {
      return NextResponse.json({ error: 'Klubben hittades inte' }, { status: 404 });
    }

    return NextResponse.json({
      user: session.user,
      clubs: session.clubs,
      activeClubId: requestedClubId,
      club,
      memberUrl: `/?klubb=${club.id}`,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
