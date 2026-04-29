import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { fetchSwebowlMatches } from '@/app/lib/swebowl';
import { getPlayDayKey, getPlayRoundInfo } from '@/app/lib/rounds';

function normalizeCode(code: string | null) {
  return code?.trim() ?? '';
}

function parseTeamIds(value?: string | null) {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getClubFromCode(code: string | null) {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return null;
  }

  return prisma.club.findFirst({
    where: {
      OR: [
        { id: normalizedCode },
        { code: normalizedCode.toUpperCase() },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const club = await getClubFromCode(body.code);

    if (!club) {
      return NextResponse.json({ error: 'Ogiltig klubbkod' }, { status: 401 });
    }

    const teamIds = parseTeamIds(body.teamIds ?? club.swebowlTeamIds ?? process.env.SWEBOWL_TEAM_IDS);
    const seasonId = Number(body.seasonId ?? club.swebowlSeason ?? process.env.SWEBOWL_SEASON_ID ?? 2025);
    const clubName = String(body.clubName ?? club.swebowlClub ?? 'BK Allön');

    const swebowlMatches = await fetchSwebowlMatches({
      clubName,
      seasonId,
      teamIds,
    });

    if (swebowlMatches.length === 0) {
      return NextResponse.json({
        imported: 0,
        updated: 0,
        message: teamIds?.length
          ? 'Swebowl svarade utan matcher för angivna lag-ID:n.'
          : 'Swebowl kunde inte hitta matcher automatiskt. Lägg lag-ID:n i SWEBOWL_TEAM_IDS eller klubbens swebowlTeamIds.',
      });
    }

    let imported = 0;
    let updated = 0;

    for (const match of swebowlMatches) {
      const dateKey = getPlayDayKey(match.date);
      const roundInfo = getPlayRoundInfo(match.date);
      const playRound = await prisma.playRound.upsert({
        where: {
          clubId_roundKey: {
            clubId: club.id,
            roundKey: roundInfo.roundKey,
          },
        },
        create: {
          clubId: club.id,
          roundKey: roundInfo.roundKey,
          title: roundInfo.title,
          startsOn: roundInfo.startsOn,
          endsOn: roundInfo.endsOn,
        },
        update: {
          startsOn: roundInfo.startsOn,
          endsOn: roundInfo.endsOn,
        },
      });
      const playDay = await prisma.playDay.upsert({
        where: {
          clubId_dateKey: {
            clubId: club.id,
            dateKey,
          },
        },
        create: {
          clubId: club.id,
          playRoundId: playRound.id,
          dateKey,
          date: new Date(`${dateKey}T00:00:00`),
        },
        update: {
          playRoundId: playRound.id,
          date: new Date(`${dateKey}T00:00:00`),
        },
      });
      const existing = await prisma.match.findUnique({
        where: {
          clubId_externalId: {
            clubId: club.id,
            externalId: match.externalId,
          },
        },
      });

      await prisma.match.upsert({
        where: {
          clubId_externalId: {
            clubId: club.id,
            externalId: match.externalId,
          },
        },
        create: {
          clubId: club.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          date: match.date,
          location: match.location,
          source: 'SWEBOWL',
          externalId: match.externalId,
          sourceTeamName: match.sourceTeamName,
          playDayId: playDay.id,
        },
        update: {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          date: match.date,
          location: match.location,
          sourceTeamName: match.sourceTeamName,
          playDayId: playDay.id,
        },
      });

      if (existing) {
        updated += 1;
      } else {
        imported += 1;
      }
    }

    return NextResponse.json({
      imported,
      updated,
      total: swebowlMatches.length,
      teamIds: teamIds ?? [],
      seasonId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Swebowl API svarade 401')) {
      return NextResponse.json({
        imported: 0,
        updated: 0,
        message: 'Swebowl blockerade automatisk klubb-sökning från servern. Lägg de fyra lag-ID:na i SWEBOWL_TEAM_IDS för att synka via kalenderfeed.',
      });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
