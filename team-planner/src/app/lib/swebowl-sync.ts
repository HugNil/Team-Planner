import { lockClub, type Actor } from './change-history';
import { matchSummary, describeSyncChange, type SyncChange } from './sync-summary';
import type { PrismaClient } from '@prisma/client';
import type { SwebowlMatch } from './swebowl';
import { getPlayDayKey, getPlayRoundInfo } from './rounds';

// Scope is independent of dates: moved matches still belong to the same season/feed.
export function getSwebowlSyncScope(seasonId: number, clubName: string, teamIds?: string[]) {
  return JSON.stringify({ seasonId, clubName: clubName.trim().toLowerCase(),
    teamIds: [...new Set(teamIds?.map((id) => id.trim()) ?? [])].sort() });
}

// Fetch and validate every feed before entering this atomic reconciliation.
export async function saveSwebowlMatches(db: PrismaClient, clubId: string, matches: SwebowlMatch[], scope: string, actor?: Actor) {
  return db.$transaction(async (tx) => {
    if (actor) await lockClub(tx, clubId);
    const changes: SyncChange[] = [];
    let imported = 0;
    let updated = 0;
    let unchanged = 0;

    for (const match of matches) {
      const existing = await tx.match.findUnique({
        where: {
          clubId_externalId: {
            clubId: clubId,
            externalId: match.externalId,
          },
        },
      });

      // An unchanged match must keep its timestamps, day, and all local data.
      if (existing && existing.homeTeam === match.homeTeam && existing.awayTeam === match.awayTeam
        && existing.date.getTime() === match.date.getTime()
        && (match.location === undefined || existing.location === match.location)
        && (match.sourceTeamName === undefined || existing.sourceTeamName === match.sourceTeamName)
        && (match.roundNumber === undefined || existing.swebowlRound === match.roundNumber)
        && existing.playDayId) {
        if (existing.swebowlSyncScope !== scope) {
          await tx.match.update({ where: { id: existing.id }, data: { swebowlSyncScope: scope, updatedAt: existing.updatedAt } });
        }
        unchanged += 1;
        continue;
      }
      const dateKey = getPlayDayKey(match.date);
      const roundInfo = getPlayRoundInfo(match.date);
      const playRound = await tx.playRound.upsert({
        where: {
          clubId_roundKey: {
            clubId: clubId,
            roundKey: roundInfo.roundKey,
          },
        },
        create: {
          clubId: clubId,
          roundKey: roundInfo.roundKey,
          title: match.roundNumber ? `Omgång ${match.roundNumber}` : roundInfo.title,
          swebowlRound: match.roundNumber,
          startsOn: roundInfo.startsOn,
          endsOn: roundInfo.endsOn,
        },
        update: {
          title: match.roundNumber ? `Omgång ${match.roundNumber}` : roundInfo.title,
          swebowlRound: match.roundNumber,
          startsOn: roundInfo.startsOn,
          endsOn: roundInfo.endsOn,
        },
      });
      const playDay = await tx.playDay.upsert({
        where: {
          clubId_dateKey: {
            clubId: clubId,
            dateKey,
          },
        },
        create: {
          clubId: clubId,
          playRoundId: playRound.id,
          dateKey,
          date: new Date(`${dateKey}T00:00:00`),
        },
        update: {
          playRoundId: playRound.id,
          date: new Date(`${dateKey}T00:00:00`),
        },
      });

      await tx.match.upsert({
        where: {
          clubId_externalId: {
            clubId: clubId,
            externalId: match.externalId,
          },
        },
        create: {
          clubId: clubId,
          swebowlSyncScope: scope,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          date: match.date,
          location: match.location,
          source: 'SWEBOWL',
          externalId: match.externalId,
          sourceTeamName: match.sourceTeamName,
          swebowlRound: match.roundNumber,
          playDayId: playDay.id,
        },
        update: {
          swebowlSyncScope: scope,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          date: match.date,
          location: match.location,
          sourceTeamName: match.sourceTeamName,
          swebowlRound: match.roundNumber,
          playDayId: playDay.id,
        },
      });

      changes.push(describeSyncChange(existing ? matchSummary(existing) : null,
        matchSummary({ ...match, location: match.location ?? existing?.location })));
      if (existing) {
        updated += 1;
      } else {
        imported += 1;
      }
    }

    // Empty feeds can be outages. Legacy/unscoped rows are deliberately not
    // deleted: their season/team coverage cannot be established safely.
    const deletionSkipped = matches.length === 0 || matches.some((match) => match.incompleteFeed);
    const removed = deletionSkipped ? [] : await tx.match.findMany({ where: {
      clubId, source: 'SWEBOWL', swebowlSyncScope: scope,
      externalId: { notIn: matches.map((match) => match.externalId) },
    } });
    const deleted = removed.length ? await tx.match.deleteMany({ where: {
      clubId, id: { in: removed.map((match) => match.id) },
    } }) : { count: 0 };
    changes.push(...removed.map((match) => describeSyncChange(matchSummary(match), null)));
    const result = { imported, updated, unchanged, deletedStale: deleted.count, deletionSkipped, changes };
    if (actor) await tx.changeLog.create({ data: {
      clubId, actorId: actor.id, actorName: actor.name, kind: 'SYNC', entityKey: scope,
      summary: `Swebowl: ${imported} nya, ${updated} uppdaterade, ${deleted.count} borttagna`,
      before: {}, after: result,
    } });
    return result;
  }, { timeout: 60_000 });
}
