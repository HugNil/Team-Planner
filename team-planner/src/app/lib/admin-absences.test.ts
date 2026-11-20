import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { createAdminAbsenceHandler } from './admin-absences';

function setup(authorized = true, missing: 'player' | 'day' | null = null) {
  const writes: unknown[] = [];
  const checks: unknown[] = [];
  let marked = false;
  const logs: unknown[] = [];
  const db = {
    $queryRaw: async () => [],
    changeLog: { create: async (args: unknown) => { logs.push(args); } },
    playDay: { findUnique: async () => ({ dateKey: '2020-01-01' }), findFirst: async (args: unknown) => { checks.push(args); return missing === 'day' ? null : { id: 'day', date: new Date('2020-01-01') }; } },
    player: { findUnique: async () => ({ firstName: 'Test', lastName: 'Player' }), findFirst: async (args: unknown) => { checks.push(args); return missing === 'player' ? null : { id: 'player' }; } },
    dayAbsence: {
      findUnique: async () => marked ? { id: 'absence' } : null,
      upsert: async (args: unknown) => { writes.push(args); marked = true; return { id: 'absence', playerId: 'player' }; },
      deleteMany: async (args: unknown) => { writes.push(args); marked = false; return { count: 1 }; },
    },
  } as unknown as PrismaClient;
  db.$transaction = (async (callback: (tx: PrismaClient) => Promise<unknown>) => callback(db)) as unknown as typeof db.$transaction;
  const handler = createAdminAbsenceHandler(db, async (clubId) => { assert.equal(clubId, 'club'); return authorized ? { user: { id: 'admin', email: 'admin@test.invalid' } } : null; });
  return { handler, writes, checks, logs };
}

function request(unavailable: unknown = true) {
  return new Request('http://localhost/api/admin/absences', { method: 'PATCH',
    body: JSON.stringify({ clubId: 'club', playDayId: 'day', playerId: 'player', unavailable }) });
}

test('admin can mark absence on a past day after deadline', async () => {
  const { handler, writes, checks, logs } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).absence.playerId, 'player');
  assert.deepEqual(checks.slice(0, 2), [
    { where: { id: 'day', clubId: 'club' }, select: { id: true } },
    { where: { id: 'player', clubId: 'club' }, select: { id: true } },
  ]);
  assert.equal(writes.length, 1);
  assert.equal(logs.length, 1);
});

test('admin can clear absence after deadline without changing other selections', async () => {
  const { handler, writes } = setup();
  const response = await handler(request(false));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { absence: null });
  assert.deepEqual(writes, [{ where: { playDayId: 'day', playerId: 'player' } }]);
});

test('unauthorized requests cannot read or change absences', async () => {
  const { handler, writes, checks } = setup(false);
  assert.equal((await handler(request())).status, 403);
  assert.deepEqual(writes, []);
  assert.deepEqual(checks, []);
});

for (const missing of ['player', 'day'] as const) {
  test(`rejects ${missing} outside the authorized club`, async () => {
    const { handler, writes } = setup(true, missing);
    assert.equal((await handler(request())).status, 404);
    assert.deepEqual(writes, []);
  });
}

test('rejects ambiguous checkbox values without writing', async () => {
  const { handler, writes } = setup();
  assert.equal((await handler(request('false'))).status, 400);
  assert.deepEqual(writes, []);
});

test('admin team absence covers double matches after deadline and leaves other teams untouched', async () => {
  const marked = new Set<string>();
  const logs: unknown[] = [];
  const matches = [
    { id: 'first', homeTeam: 'F1', awayTeam: 'Away', sourceTeamName: 'F1', externalId: null },
    { id: 'second', homeTeam: 'F1', awayTeam: 'Away', sourceTeamName: 'F1', externalId: null },
    { id: 'other', homeTeam: 'F2', awayTeam: 'Away', sourceTeamName: 'F2', externalId: null },
  ];
  const db = {
    $queryRaw: async () => [],
    team: { findFirst: async () => ({ name: 'F1', swebowlTeamId: null }) },
    player: { findFirst: async () => ({ id: 'player' }), findUnique: async () => ({ firstName: 'Test', lastName: 'Player' }) },
    playDay: {
      findMany: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, { clubId: 'club', playRoundId: 'round' });
        return [{ id: 'day', matches, absences: [], date: new Date('2020-01-01') }];
      },
      findFirst: async () => ({ id: 'day' }), findUnique: async () => ({ dateKey: '2020-01-01' }),
    },
    match: { findFirst: async () => matches[0] },
    absence: {
      findUnique: async ({ where }: { where: { matchId_playerId: { matchId: string } } }) => marked.has(where.matchId_playerId.matchId) ? { id: 'absence' } : null,
      upsert: async ({ create }: { create: { matchId: string } }) => { marked.add(create.matchId); },
      deleteMany: async ({ where }: { where: { matchId: string } }) => { marked.delete(where.matchId); },
    },
    changeLog: { create: async (data: unknown) => { logs.push(data); } },
  } as unknown as PrismaClient;
  db.$transaction = (async (callback: (tx: PrismaClient) => Promise<unknown>) => callback(db)) as unknown as typeof db.$transaction;
  const handler = createAdminAbsenceHandler(db, async () => ({ user: { id: 'admin', email: 'admin@test.invalid' } }));
  const teamRequest = (unavailable: boolean) => new Request('http://localhost/api/admin/absences', { method: 'PATCH', body: JSON.stringify({ clubId: 'club', playRoundId: 'round', teamId: 'F1', playerId: 'player', unavailable }) });
  assert.equal((await handler(teamRequest(true))).status, 200);
  assert.deepEqual([...marked], ['first', 'second']);
  assert.equal(logs.length, 2);
  assert.equal((await handler(teamRequest(false))).status, 200);
  assert.equal(marked.size, 0);
  const unauthorized = createAdminAbsenceHandler(db, async () => null);
  assert.equal((await unauthorized(teamRequest(true))).status, 403);
  assert.equal(marked.size, 0);
});
