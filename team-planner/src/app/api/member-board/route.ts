import { matchBelongsToTeam } from '@/app/lib/team-matching';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { ChangeError, lockClub, recordChangeInTransaction } from '@/app/lib/change-history';
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

    const [players, rounds, teams] = await Promise.all([
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
                externalId: true,
                sourceTeamName: true,
                absences: { include: { player: true } },
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
      prisma.team.findMany({ where: { clubId: club.id }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    ]);
    const visibleRounds = [];

    for (const round of rounds) {
      if (round.days.length > 0) {
        visibleRounds.push({ ...round, teamGroups: teams.map((team: { id: string; name: string; swebowlTeamId: string | null }) => {
          const matches = round.days.flatMap((day: { id: string; matches: Array<{ externalId: string | null; sourceTeamName: string | null; homeTeam: string; awayTeam: string }> }) => day.matches.filter(match => matchBelongsToTeam(match, team)));
          return { teamId: team.id, name: team.name, matches };
        }).filter((group: { matches: unknown[] }) => group.matches.length > 0) });
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
    return NextResponse.json({ error: errorMessage }, { status: error instanceof ChangeError ? error.status : 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const club = await getClubFromCode(body.code);
    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    const teamId = typeof body.teamId === 'string' ? body.teamId : '';
    const playRoundId = typeof body.playRoundId === 'string' ? body.playRoundId : '';
    const playDayId = typeof body.playDayId === 'string' ? body.playDayId : '';
    if (!club) return NextResponse.json({ error: 'Ogiltig klubbkod' }, { status: 401 });
    if (!playerId || typeof body.unavailable !== 'boolean' || body.matchId !== undefined || (teamId ? (!playRoundId || Boolean(playDayId)) : [playRoundId, playDayId].filter(Boolean).length !== 1)) {
      return NextResponse.json({ error: 'Välj spelare och en omgång eller ett lag i omgången.' }, { status: 400 });
    }
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockClub(tx, club.id);
      const player = await tx.player.findFirst({ where: { id: playerId, clubId: club.id } });
      const days = await tx.playDay.findMany({
        where: { clubId: club.id, ...(playRoundId ? { playRoundId } : { id: playDayId }) },
        include: { playRound: true, matches: true },
      });
      if (!player || !days.length) throw new ChangeError('Spelare eller omgång hittades inte.', 404);
      if (days.some(day => isAbsenceDeadlinePassed(day.playRound.startsOn))) throw new ChangeError('Deadline har passerat. Kontakta UK direkt.', 403);
      const actor = { name: `Medlemslänk (${player.firstName} ${player.lastName}, ej inloggad)` };
      const team = teamId ? await tx.team.findFirst({ where: { id: teamId, clubId: club.id } }) : null;
      if (teamId && (!team || !days.some(day => day.matches.some(match => matchBelongsToTeam(match, team))))) {
        throw new ChangeError('Laget har inga matcher i omgången.', 404);
      }
      for (const day of days) {
        if (team) {
          const matches = day.matches.filter(match => matchBelongsToTeam(match, team));
          if (!matches.length) continue;
          if (await tx.dayAbsence.findUnique({ where: { playDayId_playerId: { playDayId: day.id, playerId } } })) throw new ChangeError('Avmarkera hela omgången eller dagen först.');
          for (const match of matches) {
            await recordChangeInTransaction(tx, club.id, actor, { kind: 'ABSENCE', playDayId: day.id, playerId, matchId: match.id },
              `Lagfrånvaro ${body.unavailable ? 'markerad' : 'avmarkerad'} (${team.name})`, async tx => {
                const where = { matchId: match.id, playerId };
                if (body.unavailable) await tx.absence.upsert({ where: { matchId_playerId: where }, create: where, update: {} });
                else await tx.absence.deleteMany({ where });
              });
          }
        } else {
          await recordChangeInTransaction(tx, club.id, actor, { kind: 'ABSENCE', playDayId: day.id, playerId },
            body.unavailable ? 'Frånvaro markerad' : 'Frånvaro avmarkerad', async tx => {
              const where = { playDayId: day.id, playerId };
              if (body.unavailable) await tx.dayAbsence.upsert({ where: { playDayId_playerId: where }, create: where, update: {} });
              else await tx.dayAbsence.deleteMany({ where });
            });
          if (playRoundId && !body.unavailable) {
            for (const match of day.matches) {
              await recordChangeInTransaction(tx, club.id, actor, { kind: 'ABSENCE', playDayId: day.id, playerId, matchId: match.id },
                'Lagfrånvaro avmarkerad för hela omgången', async tx => {
                  await tx.absence.deleteMany({ where: { matchId: match.id, playerId } });
                });
            }
          }
        }
      }
    }, { timeout: 15_000 });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: error instanceof ChangeError ? error.status : 500 });
  }
}
