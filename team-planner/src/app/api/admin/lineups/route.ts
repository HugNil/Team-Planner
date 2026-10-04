import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireClubAccess } from '@/app/lib/admin-auth';
import { recordChange } from '@/app/lib/change-history';
import { getLineupConflict } from '@/app/lib/lineup-eligibility';
import { prisma } from '@/app/lib/prisma';

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function matchBelongsToTeam(
  match: { externalId: string | null; sourceTeamName: string | null; homeTeam: string; awayTeam: string },
  team: { name: string; swebowlTeamId: string | null },
) {
  const teamId = team.swebowlTeamId ? normalize(team.swebowlTeamId.split(':')[0]) : '';
  const teamName = normalize(team.name);
  const externalId = normalize(match.externalId);
  const sourceTeamName = normalize(match.sourceTeamName);
  const homeTeam = normalize(match.homeTeam);
  const awayTeam = normalize(match.awayTeam);

  if (teamId) {
    return externalId.includes(teamId) || sourceTeamName === teamId || sourceTeamName.includes(teamId);
  }

  return Boolean(teamName && (sourceTeamName.includes(teamName) || homeTeam.includes(teamName) || awayTeam.includes(teamName)));
}

const lineupInclude = {
  team: true,
  players: {
    include: { player: true },
    orderBy: { sortOrder: 'asc' as const },
  },
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId') ?? '';
    const playRoundId = searchParams.get('playRoundId') ?? '';
    const access = await requireClubAccess(clubId, ['ADMIN', 'UK']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet' }, { status: 403 });
    }

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
      include: lineupInclude,
      orderBy: [{ playDay: { date: 'asc' } }, { team: { sortOrder: 'asc' } }],
    });
    const teamPlans = teams.map((team: { id: string; name: string; swebowlTeamId: string | null }) => {
      const playDay =
        playRound.days.find((day: { matches: Array<{ externalId: string | null; sourceTeamName: string | null; homeTeam: string; awayTeam: string }> }) =>
          day.matches.some((match) => matchBelongsToTeam(match, team)),
        ) ??
        playRound.days[0] ??
        null;
      const lineup = playDay
        ? lineups.find((item: { teamId: string; playDayId: string }) => item.teamId === team.id && item.playDayId === playDay.id) ?? null
        : null;
      const matches =
        playDay?.matches.filter((match: { externalId: string | null; sourceTeamName: string | null; homeTeam: string; awayTeam: string }) =>
          matchBelongsToTeam(match, team),
        ) ?? [];

      return { team, playDay, matches, lineup };
    });

    return NextResponse.json({ players, teams, playRound, days: playRound.days, lineups, teamPlans });
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

    if (action === 'remove') {
      const playDay = await prisma.playDay.findFirst({ where: { id: playDayId, clubId }, select: { id: true } });

      if (!playDay || !playerId || !teamId) {
        return NextResponse.json({ error: 'Fel klubb, dag, lag eller spelare' }, { status: 400 });
      }

      await recordChange(prisma, clubId, { id: access.user.id, name: access.user.email },
        { kind: 'LINEUP', playDayId, teamId }, 'Spelare borttagen', async (tx) => {
      await tx.lineupPlayer.deleteMany({
        where: {
          playerId,
          lineup: { playDayId, clubId, teamId },
        },
      });

      });
      return NextResponse.json({ ok: true, playerId });
    }

    const [playDay, team] = await Promise.all([
      prisma.playDay.findFirst({
        where: { id: playDayId, clubId },
        select: {
          id: true,
          playRoundId: true,
          absences: { select: { playerId: true } },
        },
      }),
      prisma.team.findFirst({ where: { id: teamId, clubId } }),
    ]);

    if (!playDay || !team) {
      return NextResponse.json({ error: 'Fel klubb, dag, lag eller spelare' }, { status: 400 });
    }

    if (action === 'coach') {
      const lineup = await recordChange(prisma, clubId, { id: access.user.id, name: access.user.email },
        { kind: 'LINEUP', playDayId, teamId }, coachName ? 'Coach ändrad' : 'Coach borttagen', async (tx) => {
      return tx.lineup.upsert({
        where: { playDayId_teamId: { playDayId, teamId } },
        create: { clubId, playDayId, teamId, coachName: coachName || null },
        update: { coachName: coachName || null },
        include: lineupInclude,
      });

      });
      return NextResponse.json({ ok: true, lineup });
    }

    const player = await prisma.player.findFirst({ where: { id: playerId, clubId } });

    if (!player) {
      return NextResponse.json({ error: 'Fel klubb, dag, lag eller spelare' }, { status: 400 });
    }

    const [roundDayCount, roundAbsenceCount] = await Promise.all([
      prisma.playDay.count({ where: { playRoundId: playDay.playRoundId } }),
      prisma.dayAbsence.count({ where: { playerId, playDay: { playRoundId: playDay.playRoundId } } }),
    ]);

    if (roundDayCount > 0 && roundDayCount === roundAbsenceCount) {
      return NextResponse.json({ error: 'Spelaren är frånvarande hela omgången' }, { status: 409 });
    }

    if (playDay.absences.some((absence: { playerId: string }) => absence.playerId === playerId)) {
      return NextResponse.json({ error: 'Spelaren är kryssad som frånvarande den dagen' }, { status: 409 });
    }

    if (!Number.isInteger(sortOrder)) {
      return NextResponse.json({ error: 'Ogiltig plats' }, { status: 400 });
    }
    const result = await recordChange(prisma, clubId, { id: access.user.id, name: access.user.email },
      { kind: 'LINEUP', playDayId, teamId }, 'Laguttagning ändrad', async (tx: Prisma.TransactionClient) => {
      // Serialize changes in this round so simultaneous assignments cannot
      // both claim the same shared-player allowance.
      await tx.$queryRaw`SELECT id FROM "PlayRound" WHERE id = ${playDay.playRoundId} FOR UPDATE`;
      const roundLineups = await tx.lineup.findMany({
        where: { clubId, playDay: { playRoundId: playDay.playRoundId } },
        include: { players: true },
      });
      const conflict = getLineupConflict(roundLineups, playerId, teamId, sortOrder, playDayId);
      if (conflict) return { conflict, lineup: null };
      const lineup = await tx.lineup.upsert({
        where: { playDayId_teamId: { playDayId, teamId } },
        create: { clubId, playDayId, teamId },
        update: {},
      });
      await tx.lineupPlayer.deleteMany({
        where: { lineupId: lineup.id, OR: [{ playerId }, { sortOrder }] },
      });
      await tx.lineupPlayer.create({ data: { lineupId: lineup.id, playerId, sortOrder } });
      return { conflict: null, lineup: await tx.lineup.findUnique({
        where: { id: lineup.id }, include: lineupInclude,
      }) };
    });
    if (result.conflict) return NextResponse.json({ error: result.conflict }, { status: 409 });
    const updatedLineup = result.lineup;

    return NextResponse.json({ ok: true, lineup: updatedLineup, playerId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
