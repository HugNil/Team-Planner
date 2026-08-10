import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { isAbsenceDeadlinePassed } from '@/app/lib/rounds';

function normalizeCode(code: string | null) {
  return code?.trim() ?? '';
}

function isPublicClubId(value: string) {
  return /^c[a-z0-9]{20,}$/i.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getClubFromCode(code: string | null) {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return null;
  }

  if (normalizedCode.toUpperCase() === 'TEST') {
    return prisma.club.findUnique({ where: { code: 'TEST' } });
  }

  if (!isPublicClubId(normalizedCode)) {
    return null;
  }

  return prisma.club.findUnique({ where: { id: normalizedCode } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const club = await getClubFromCode(searchParams.get('code'));

    if (!club) {
      return NextResponse.json({ error: 'Ogiltig klubbkod' }, { status: 401 });
    }

    const [players, rounds] = await Promise.all([
      prisma.player.findMany({
        where: { clubId: club.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          number: true,
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' },
        ],
      }),
      prisma.playRound.findMany({
        where: {
          clubId: club.id,
          days: {
            some: {
              matches: { some: {} },
            },
          },
        },
        include: {
          days: {
            where: {
              matches: { some: {} },
            },
            include: {
            matches: {
              select: {
                id: true,
                homeTeam: true,
                awayTeam: true,
                date: true,
                location: true,
              },
              orderBy: { date: 'asc' },
            },
            absences: {
              include: {
                player: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    number: true,
                  },
                },
              },
              orderBy: {
                player: {
                  firstName: 'asc',
                },
              },
            },
            },
            orderBy: { date: 'asc' },
          },
        },
        orderBy: { startsOn: 'asc' },
      }),
    ]);
    const visibleRounds = [];

    for (const round of rounds) {
      if (round.days.length > 0) {
        visibleRounds.push(round);
      }
    }

    return NextResponse.json({
      club: {
        id: club.id,
        name: club.name,
      },
      rounds: visibleRounds,
      matches: [],
      players,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const club = await getClubFromCode(body.code);
    const playDayId = typeof body.playDayId === 'string' ? body.playDayId : '';
    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    const unavailable = Boolean(body.unavailable);

    if (!club) {
      return NextResponse.json({ error: 'Ogiltig klubbkod' }, { status: 401 });
    }

    if (!playDayId || !playerId) {
      return NextResponse.json({ error: 'playDayId och playerId krävs' }, { status: 400 });
    }

    const [playDay, player] = await Promise.all([
      prisma.playDay.findFirst({ where: { id: playDayId, clubId: club.id }, include: { playRound: true } }),
      prisma.player.findFirst({ where: { id: playerId, clubId: club.id } }),
    ]);

    if (!playDay || !player) {
      return NextResponse.json({ error: 'Speldag eller spelare hittades inte' }, { status: 404 });
    }

    if (isAbsenceDeadlinePassed(playDay.playRound.startsOn)) {
      return NextResponse.json({ error: 'Deadline har passerat. Kontakta UK direkt.' }, { status: 403 });
    }

    if (unavailable) {
      const absence = await prisma.dayAbsence.upsert({
        where: {
          playDayId_playerId: {
            playDayId,
            playerId,
          },
        },
        create: {
          playDayId,
          playerId,
        },
        update: {},
        include: {
          player: true,
        },
      });

      return NextResponse.json({ absence });
    }

    await prisma.dayAbsence.deleteMany({
      where: {
        playDayId,
        playerId,
      },
    });

    return NextResponse.json({ absence: null });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
