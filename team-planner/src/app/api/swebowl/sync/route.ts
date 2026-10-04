import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { fetchSwebowlMatches } from '@/app/lib/swebowl';
import { getSwebowlSyncScope, saveSwebowlMatches } from '@/app/lib/swebowl-sync';
import { requireClubAccess } from '@/app/lib/admin-auth';

function normalizeCode(code: string | null) {
  return code?.trim() ?? '';
}

function isPublicClubId(value: string) {
  return /^c[a-z0-9]{20,}$/i.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  if (normalizedCode.toUpperCase() === 'TEST') {
    return prisma.club.findUnique({ where: { code: 'TEST' } });
  }

  if (!isPublicClubId(normalizedCode)) {
    return null;
  }

  return prisma.club.findUnique({ where: { id: normalizedCode } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const club = await getClubFromCode(body.code);

    if (!club) {
      return NextResponse.json({ error: 'Ogiltig klubbkod' }, { status: 401 });
    }

    const access = await requireClubAccess(club.id, ['ADMIN']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet till klubben' }, { status: 403 });
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

    const result = await saveSwebowlMatches(prisma, club.id, swebowlMatches,
      getSwebowlSyncScope(seasonId, clubName, teamIds), { id: access.user.id, name: access.user.email });

    return NextResponse.json({
      ...result,
      message: `Synk klar: ${result.imported} nya, ${result.updated} uppdaterade, ${result.unchanged} oförändrade, ${result.deletedStale} borttagna.${result.deletionSkipped ? ' Kalenderflödet visar bara kommande matcher, därför har inga saknade matcher tagits bort.' : ''}`,
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
        error: 'Swebowl blockerade automatisk klubb-sökning från servern. Lägg de fyra lag-ID:na i SWEBOWL_TEAM_IDS för att synka via kalenderfeed. Inga matcher har ändrats.',
      }, { status: 502 });
    }

    return NextResponse.json({ error: `Synk misslyckades. Inga matcher har ändrats. ${errorMessage}` }, { status: 500 });
  }
}
