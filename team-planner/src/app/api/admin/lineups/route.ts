import { NextResponse } from 'next/server';
import { requireClubAccess } from '@/app/lib/admin-auth';
import { prisma } from '@/app/lib/prisma';

async function getPlannerClub(playDayId: string) {
  return prisma.playDay.findUnique({
    where: { id: playDayId },
    include: { absences: true },
  });
}

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function matchBelongsToTeam(match: { externalId: string | null; sourceTeamName: string | null; homeTeam: string; awayTeam: string }, team: { name: string; swebowlTeamId: string | null }) {
  const teamId = team.swebowlTeamId ? normalize(team.swebowlTeamId) : '';
  const teamName = normalize(team.name);
  const externalId = normalize(match.externalId);
  const sourceTeamName = normalize(match.sourceTeamName);
  const homeTeam = normalize(match.homeTeam);
  const awayTeam = normalize(match.awayTeam);

  return Boolean(
    (teamId && (externalId.includes(teamId) || sourceTeamName.includes(teamId))) ||
    (teamName && (sourceTeamName.includes(teamName) || homeTeam.includes(teamName) || awayTeam.includes(teamName))),
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId') ?? '';
    const playDayId = searchParams.get('playDayId') ?? '';
    const playRoundId = searchParams.get('playRoundId') ?? '';
    const access = await requireClubAccess(clubId, ['ADMIN', 'UK']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet' }, { status: 403 });
    }

    if (playRoundId) {
      const [players, teams, playRound] = await Promise.all([
        prisma.player.findMany({ where: { clubId }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
        prisma.team.findMany({ where: { clubId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
        prisma.playRound.findUnique({
          where: { id: playRoundId },
          include: {
            days: {
              include: {
                absences: { include: { player: true } },
                matches: { orderBy: { date: 'asc' } },
              },
              orderBy: { date: 'asc' },
            },
          },
        }),
      ]);

      if (!playRound || playRound.clubId !== clubId) {
        return NextResponse.json({ error: 'Omgången hittades inte' }, { status: 404 });
      }

      const dayIds = playRound.days.map((day: { id: string }) => day.id);
      const lineups = await prisma.lineup.findMany({
        where: { clubId, playDayId: { in: dayIds } },
        include: {
          team: true,
          players: {
            include: { player: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ playDay: { date: 'asc' } }, { team: { sortOrder: 'asc' } }],
      });
      const teamPlans = teams.map((team: { id: string; name: string; swebowlTeamId: string | null }) => {
        const playDay = playRound.days.find((day: { matches: Array<{ externalId: string | null; sourceTeamName: string | null; homeTeam: string; awayTeam: string }> }) => day.matches.some((match) => matchBelongsToTeam(match, team))) ?? playRound.days[0] ?? null;
        const lineup = playDay ? lineups.find((item: { teamId: string; playDayId: string }) => item.teamId === team.id && item.playDayId === playDay.id) ?? null : null;
        const matches = playDay?.matches.filter((match: { externalId: string | null; sourceTeamName: string | null; homeTeam: string; awayTeam: string }) => matchBelongsToTeam(match, team)) ?? [];

        return { team, playDay, matches: matches.length > 0 ? matches : playDay?.matches ?? [], lineup };
      });

      return NextResponse.json({ players, teams, playRound, days: playRound.days, lineups, teamPlans });
    }

    const [players, teams, playDay, lineups] = await Promise.all([
      prisma.player.findMany({ where: { clubId }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
      prisma.team.findMany({ where: { clubId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.playDay.findUnique({
        where: { id: playDayId },
        include: { absences: true, matches: { orderBy: { date: 'asc' } }, playRound: true },
      }),
      prisma.lineup.findMany({
        where: { clubId, playDayId },
        include: {
          team: true,
          players: {
            include: { player: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { team: { sortOrder: 'asc' } },
      }),
    ]);

    if (!playDay || playDay.clubId !== clubId) {
      return NextResponse.json({ error: 'Speldagen hittades inte' }, { status: 404 });
    }

    return NextResponse.json({ players, teams, playDay, lineups });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const clubId = String(body.clubId ?? '');
    const playDayId = String(body.playDayId ?? '');
    const teamId = String(body.teamId ?? '');
    const playerId = String(body.playerId ?? '');
    const action = String(body.action ?? 'add');
    const coachName = String(body.coachName ?? '').trim();
    const sortOrder = Math.max(0, Math.min(8, Number(body.sortOrder ?? 0)));
    const access = await requireClubAccess(clubId, ['ADMIN', 'UK']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet' }, { status: 403 });
    }

    const [playDay, team, player, playRound] = await Promise.all([
      getPlannerClub(playDayId),
      prisma.team.findUnique({ where: { id: teamId } }),
      playerId ? prisma.player.findUnique({ where: { id: playerId } }) : Promise.resolve(null),
      prisma.playDay.findUnique({
        where: { id: playDayId },
        include: { playRound: { include: { days: { include: { absences: true } } } } },
      }),
    ]);

    if (!playDay || playDay.clubId !== clubId || !team || team.clubId !== clubId) {
      return NextResponse.json({ error: 'Fel klubb, dag, lag eller spelare' }, { status: 400 });
    }

    if (action === 'coach') {
      await prisma.lineup.upsert({
        where: {
          playDayId_teamId: { playDayId, teamId },
        },
        create: { clubId, playDayId, teamId, coachName: coachName || null },
        update: { coachName: coachName || null },
      });
      return NextResponse.json({ ok: true });
    }

    if (!player || player.clubId !== clubId) {
      return NextResponse.json({ error: 'Fel klubb, dag, lag eller spelare' }, { status: 400 });
    }

    if (playRound?.playRound.days.length && playRound.playRound.days.every((day: { absences: Array<{ playerId: string }> }) => day.absences.some((absence) => absence.playerId === playerId))) {
      return NextResponse.json({ error: 'Spelaren är frånvarande hela omgången' }, { status: 409 });
    }

    if (action === 'remove') {
      await prisma.lineupPlayer.deleteMany({
        where: {
          playerId,
          lineup: { playDayId, clubId },
        },
      });
      return NextResponse.json({ ok: true });
    }

    let absent = false;

    for (const absence of playDay.absences) {
      if (absence.playerId === playerId) {
        absent = true;
        break;
      }
    }

    if (absent) {
      return NextResponse.json({ error: 'Spelaren är kryssad som frånvarande den dagen' }, { status: 409 });
    }

    const lineup = await prisma.lineup.upsert({
      where: {
        playDayId_teamId: { playDayId, teamId },
      },
      create: { clubId, playDayId, teamId },
      update: {},
    });

    await prisma.lineupPlayer.deleteMany({
      where: {
        playerId,
        lineup: { playDayId, clubId },
      },
    });

    await prisma.lineupPlayer.deleteMany({
      where: {
        lineupId: lineup.id,
        sortOrder,
      },
    });

    await prisma.lineupPlayer.create({
      data: {
        lineupId: lineup.id,
        playerId,
        sortOrder,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
