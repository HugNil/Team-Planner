import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { recordChange, undoChange } from './change-history';
import { saveSwebowlMatches } from './swebowl-sync';
import { copyPreviousLineup } from './copy-lineup';

// All fixtures and mutations live inside an outer transaction that is always rolled back.
test('database: audited copy, undo, conflict detection, and club isolation', { skip: !process.env.RUN_HISTORY_DB_TESTS }, async () => {
  const db = new PrismaClient();
  const rollback = new Error('ROLLBACK_TEST_FIXTURES');
  try {
    await assert.rejects(db.$transaction(async (tx) => {
      const suffix = `${Date.now()}-${Math.random()}`;
      const club = await tx.club.create({ data: { name: `History test ${suffix}`, code: `history-${suffix}` } });
      const team = await tx.team.create({ data: { clubId: club.id, name: 'Test A' } });
      const players = await Promise.all(['Available', 'Absent'].map((firstName) => tx.player.create({ data: { clubId: club.id, firstName, lastName: 'Test' } })));
      const days: { id: string }[] = [];
      for (const key of ['2026-10-03', '2026-10-10']) {
        const round = await tx.playRound.create({ data: { clubId: club.id, roundKey: key, title: key, startsOn: new Date(key), endsOn: new Date(key) } });
        days.push(await tx.playDay.create({ data: { clubId: club.id, playRoundId: round.id, dateKey: key, date: new Date(key) } }));
      }
      await tx.lineup.create({ data: { clubId: club.id, playDayId: days[0].id, teamId: team.id, coachName: 'Original coach',
        players: { create: players.map((p, sortOrder) => ({ playerId: p.id, sortOrder })) } } });
      await tx.dayAbsence.create({ data: { playDayId: days[1].id, playerId: players[1].id } });
      const scopedDb = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
      const actor = { id: 'fixture-admin', name: 'Test admin' };
      const copied = await copyPreviousLineup(scopedDb, club.id, days[1].id, team.id, actor);
      assert.equal(copied.copied, 1);
      assert.equal(copied.skipped.length, 1);
      assert.equal(copied.lineup?.coachName, 'Original coach');
      assert.equal(copied.lineup?.players[0].playerId, players[0].id);
      assert.equal(copied.lineup?.players[0].sortOrder, 0);
      const copyLog = await tx.changeLog.findFirstOrThrow({ where: { clubId: club.id } });
      assert.equal(copyLog.actorId, actor.id);
      await assert.rejects(copyPreviousLineup(scopedDb, club.id, days[1].id, team.id, actor), /redan/);
      await assert.rejects(undoChange(scopedDb, 'wrong-club', copyLog.id, actor), /inte ångras/);
      const target = { kind: 'LINEUP' as const, playDayId: days[1].id, teamId: team.id };
      await recordChange(scopedDb, club.id, actor, target, 'Coach ändrad', async (client) => client.lineup.update({ where: { id: copied.lineup!.id }, data: { coachName: 'New coach' } }));
      await assert.rejects(undoChange(scopedDb, club.id, copyLog.id, actor), /ändrats igen/);
      const coachLog = await tx.changeLog.findFirstOrThrow({ where: { clubId: club.id, id: { not: copyLog.id } } });
      await undoChange(scopedDb, club.id, coachLog.id, actor);
      assert.equal((await tx.lineup.findUniqueOrThrow({ where: { id: copied.lineup!.id } })).coachName, 'Original coach');
      await undoChange(scopedDb, club.id, copyLog.id, actor);
      assert.equal(await tx.lineupPlayer.count({ where: { lineupId: copied.lineup!.id } }), 0);
      assert.equal((await tx.lineup.findUniqueOrThrow({ where: { id: copied.lineup!.id } })).coachName, null);
      await assert.rejects(undoChange(scopedDb, club.id, copyLog.id, actor), /inte ångras/);
      // Other rounds remain intact.
      assert.equal(await tx.lineupPlayer.count({ where: { lineup: { playDayId: days[0].id } } }), 2);
      assert.equal(await tx.dayAbsence.count({ where: { playDayId: days[1].id } }), 1);
      const absenceTarget = { kind: 'ABSENCE' as const, playDayId: days[1].id, playerId: players[1].id };
      await recordChange(scopedDb, club.id, actor, absenceTarget, 'Kryss borttaget', async (client) => client.dayAbsence.deleteMany({ where: { playDayId: days[1].id, playerId: players[1].id } }));
      const absenceLog = await tx.changeLog.findFirstOrThrow({ where: { clubId: club.id, kind: 'ABSENCE' } });
      await undoChange(scopedDb, club.id, absenceLog.id, actor);
      assert.equal(await tx.dayAbsence.count({ where: { playDayId: days[1].id } }), 1);
      const oldMatch = { clubId: club.id, homeTeam: 'Home', awayTeam: 'Away', date: new Date('2026-10-03T12:00:00Z'), source: 'SWEBOWL' as const, swebowlSyncScope: 'test-scope' };
      await tx.match.createMany({ data: [
        { ...oldMatch, externalId: 'moved' }, { ...oldMatch, externalId: 'removed' },
        { ...oldMatch, externalId: 'other-season', swebowlSyncScope: 'other' },
      ] });
      const sync = await saveSwebowlMatches(scopedDb, club.id, [
        { externalId: 'moved', homeTeam: 'Home', awayTeam: 'Away', date: new Date('2026-10-10T12:00:00Z'), location: 'New hall' },
        { externalId: 'new', homeTeam: 'Home', awayTeam: 'Other', date: new Date('2026-10-10T14:00:00Z') },
      ], 'test-scope', actor);
      assert.equal(sync.imported, 1);
      assert.equal(sync.updated, 1);
      assert.equal(sync.deletedStale, 1);
      assert.deepEqual(sync.changes.map((c) => c.kind), ['moved', 'added', 'removed']);
      assert.equal(sync.changes[0].before?.date, oldMatch.date.toISOString());
      assert.equal(sync.changes[0].after?.date, '2026-10-10T12:00:00.000Z');
      assert.equal(await tx.match.count({ where: { clubId: club.id } }), 3);
      const syncLog = await tx.changeLog.findFirstOrThrow({ where: { clubId: club.id, kind: 'SYNC' } });
      assert.equal(syncLog.actorName, actor.name);
      await assert.rejects(undoChange(scopedDb, club.id, syncLog.id, actor), /inte ångras/);
      throw rollback;
    }, { timeout: 30_000 }), (error) => error === rollback);
  } finally { await db.$disconnect(); }
});
