import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { getSwebowlSyncScope, saveSwebowlMatches } from './swebowl-sync';

// Only transaction-scoped delegates exist: accidental writes outside the
// transaction or deletion of planning data will fail these tests.
function database(existing: boolean, fail = false, same = false, deleteFails = false) {
  const writes: Array<{ where: unknown; update: Record<string, unknown> }> = [];
  let options: unknown;
  const deletions: unknown[] = [];
  const queries: unknown[] = [];
  const tx = {
    playRound: { upsert: async () => ({ id: 'round-new' }) },
    playDay: { upsert: async () => ({ id: 'day-new' }) },
    match: {
      findMany: async (args: unknown) => { queries.push(args); return [{ ...match, id: 'removed-1' }, { ...match, id: 'removed-2' }]; },
      findUnique: async () => existing ? { ...match, date: same ? match.date : new Date('2026-10-10T14:00:00Z'), id: 'match-existing', playDayId: 'day-existing', swebowlSyncScope: 'scope' } : null,
      deleteMany: async (args: unknown) => { if (deleteFails) throw new Error('Delete failed'); deletions.push(args); return { count: 2 }; },
      upsert: async (args: typeof writes[number]) => {
        if (fail) throw new Error('Database unavailable');
        writes.push(args);
      },
    },
  };
  const db = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>, config: unknown) => {
      options = config;
      return callback(tx);
    },
  } as unknown as PrismaClient;
  return { db, writes, deletions, queries, options: () => options };
}

const match = {
  externalId: 'swebowl-match-123', homeTeam: 'Home', awayTeam: 'Away',
  date: new Date('2026-10-17T14:00:00Z'), location: 'New hall',
};

test('updates moved matches by stable ID without replacing assignments or absences', async () => {
  const mock = database(true);
  const { changes, ...counts } = await saveSwebowlMatches(mock.db, 'club', [match], 'scope');
  assert.equal(changes.length, 3);
  assert.deepEqual(counts, { imported: 0, updated: 1, unchanged: 0, deletedStale: 2, deletionSkipped: false });
  assert.deepEqual(mock.writes[0].where, { clubId_externalId: { clubId: 'club', externalId: match.externalId } });
  assert.equal(mock.writes[0].update.date, match.date);
  assert.equal(mock.writes[0].update.location, 'New hall');
  assert.equal(mock.writes[0].update.playDayId, 'day-new');
  assert.equal('assignments' in mock.writes[0].update, false);
  assert.equal('absences' in mock.writes[0].update, false);
  assert.equal('id' in mock.writes[0].update, false);
  assert.deepEqual(mock.options(), { timeout: 60_000 });
});

test('imports new matches', async () => {
  const mock = database(false);
  const { changes, ...counts } = await saveSwebowlMatches(mock.db, 'club', [match], 'scope');
  assert.equal(changes.length, 3);
  assert.deepEqual(counts, { imported: 1, updated: 0, unchanged: 0, deletedStale: 2, deletionSkipped: false });
});

test('empty responses perform no match writes or deletions', async () => {
  const mock = database(true);
  const { changes, ...counts } = await saveSwebowlMatches(mock.db, 'club', [], 'scope');
  assert.deepEqual(changes, []);
  assert.deepEqual(counts, { imported: 0, updated: 0, unchanged: 0, deletedStale: 0, deletionSkipped: true });
  assert.equal(mock.writes.length, 0);
});

test('write errors escape the transaction callback so Prisma rolls it back', async () => {
  const mock = database(true, true);
  await assert.rejects(saveSwebowlMatches(mock.db, 'club', [match], 'scope'), /Database unavailable/);
});


test('unchanged matches keep their day, timestamps and all person selections without a write', async () => {
  const mock = database(true, false, true);
  const result = await saveSwebowlMatches(mock.db, 'club', [match], 'scope');
  assert.equal(result.unchanged, 1);
  assert.equal(mock.writes.length, 0);
});

test('deletion only targets missing Swebowl matches in this club and exact scope', async () => {
  const mock = database(true);
  await saveSwebowlMatches(mock.db, 'club', [match], 'scope');
  assert.deepEqual(mock.queries, [{ where: {
    clubId: 'club', source: 'SWEBOWL', swebowlSyncScope: 'scope',
    externalId: { notIn: [match.externalId] },
  } }]);
  assert.deepEqual(mock.deletions, [{ where: { clubId: 'club', id: { in: ['removed-1', 'removed-2'] } } }]);
});

test('empty feed and failed write never reach deletion', async () => {
  const empty = database(true);
  await saveSwebowlMatches(empty.db, 'club', [], 'scope');
  assert.deepEqual(empty.deletions, []);
  const failed = database(true, true);
  await assert.rejects(saveSwebowlMatches(failed.db, 'club', [match], 'scope'));
  assert.deepEqual(failed.deletions, []);
});

test('scope is stable for reordered teams but distinct for another season or subset', () => {
  const scope = getSwebowlSyncScope(2026, 'Club', ['a', 'b']);
  assert.equal(scope, getSwebowlSyncScope(2026, 'Club', ['b', 'a', 'a']));
  assert.notEqual(scope, getSwebowlSyncScope(2025, 'Club', ['a', 'b']));
  assert.notEqual(scope, getSwebowlSyncScope(2026, 'Club', ['a']));
});


test('deletion failure rejects the whole transaction including earlier updates', async () => {
  const mock = database(true, false, false, true);
  await assert.rejects(saveSwebowlMatches(mock.db, 'club', [match], 'scope'), /Delete failed/);
  assert.equal(mock.writes.length, 1);
});


test('calendar fallback updates matches without deleting past or absent matches', async () => {
  const mock = database(true);
  const result = await saveSwebowlMatches(mock.db, 'club', [{ ...match, incompleteFeed: true }], 'scope');
  assert.equal(result.updated, 1);
  assert.equal(result.deletionSkipped, true);
  assert.deepEqual(mock.deletions, []);
});
