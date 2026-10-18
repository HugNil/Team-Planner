import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameSnapshot } from './change-history';
import { filterCopyPlayers } from './copy-lineup';
import { describeSyncChange, matchSummary } from './sync-summary';

test('history compares JSONB snapshots regardless of object key order', () => {
  assert.equal(sameSnapshot({ players: [{ playerId: 'p', sortOrder: 0 }], coachName: null },
    { coachName: null, players: [{ sortOrder: 0, playerId: 'p' }] }), true);
  assert.equal(sameSnapshot({ unavailable: true }, { unavailable: false }), false);
});
test('copy preserves positions and skips only absent players including reserve', () => {
  const players = [{ playerId: 'one', sortOrder: 0 }, { playerId: 'two', sortOrder: 3 }, { playerId: 'reserve', sortOrder: 8 }];
  assert.deepEqual(filterCopyPlayers(players, new Set(['one', 'reserve'])), {
    included: [players[1]], skipped: [players[0], players[2]],
  });
});
test('sync report retains exact before and after date and hall', () => {
  const before = matchSummary({ externalId: 'm', homeTeam: 'Home', awayTeam: 'Away', date: new Date('2026-10-01T12:00:00Z'), location: 'Old' });
  const after = { ...before, date: '2026-10-08T14:00:00.000Z', location: 'New' };
  assert.deepEqual(describeSyncChange(before, after), { kind: 'moved', before, after });
  assert.equal(describeSyncChange(null, after).kind, 'added');
  assert.equal(describeSyncChange(before, null).kind, 'removed');
  assert.equal(describeSyncChange(before, { ...before, location: 'New' }).kind, 'updated');
});

test('a swap is recorded and undone as one change across both lineups', async () => {
  const { recordChange, undoChange } = await import('./change-history');
  const lineups = new Map([
    ['A', { id: 'A', coachName: null, players: [{ playerId: 'one', sortOrder: 0 }] }],
    ['B', { id: 'B', coachName: null, players: [{ playerId: 'two', sortOrder: 8 }] }],
  ]);
  type Entry = { id: string; kind: string; entityKey: string; before: unknown; after: unknown; undoneAt?: Date };
  let entry: Entry | undefined;
  const tx = {
    $queryRaw: async () => [],
    playDay: { findFirst: async () => ({ id: 'day' }), findUnique: async () => ({ dateKey: '2026-10-05' }) },
    team: { findFirst: async () => ({ id: 'team' }), findUnique: async () => ({ name: 'Team' }) },
    player: { count: async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.length },
    dayAbsence: { count: async () => 0 },
    lineup: {
      findUnique: async ({ where }: { where: { playDayId_teamId: { teamId: string } } }) => lineups.get(where.playDayId_teamId.teamId),
      upsert: async ({ where }: { where: { playDayId_teamId: { teamId: string } } }) => lineups.get(where.playDayId_teamId.teamId),
    },
    lineupPlayer: {
      deleteMany: async ({ where }: { where: { lineupId: string } }) => { lineups.get(where.lineupId)!.players = []; },
      createMany: async ({ data }: { data: { lineupId: string; playerId: string; sortOrder: number }[] }) => {
        for (const { lineupId, playerId, sortOrder } of data) lineups.get(lineupId)!.players.push({ playerId, sortOrder });
      },
    },
    changeLog: {
      create: async ({ data }: { data: Omit<Entry, 'id'> }) => { entry = structuredClone({ id: 'change', ...data }); },
      findFirst: async () => entry,
      update: async ({ data }: { data: { undoneAt: Date } }) => { Object.assign(entry!, data); },
    },
  };
  const db = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as import('@prisma/client').PrismaClient;
  const actor = { name: 'Admin' };
  await recordChange(db, 'club', actor, { kind: 'LINEUP', teamId: 'A', playDayId: 'day', swapWith: { teamId: 'B', playDayId: 'day' } }, 'Swap', async () => {
    lineups.get('A')!.players = [{ playerId: 'two', sortOrder: 0 }];
    lineups.get('B')!.players = [{ playerId: 'one', sortOrder: 8 }];
  });
  // A later edit to either side must prevent undo of the entire swap.
  lineups.get('B')!.players = [{ playerId: 'three', sortOrder: 8 }];
  await assert.rejects(undoChange(db, 'club', 'change', actor), /ändrats igen/);
  assert.equal(lineups.get('A')!.players[0].playerId, 'two');
  lineups.get('B')!.players = [{ playerId: 'one', sortOrder: 8 }];
  await undoChange(db, 'club', 'change', actor);
  assert.deepEqual(lineups.get('A')!.players, [{ playerId: 'one', sortOrder: 0 }]);
  assert.deepEqual(lineups.get('B')!.players, [{ playerId: 'two', sortOrder: 8 }]);
  assert.ok(entry?.undoneAt);
});
