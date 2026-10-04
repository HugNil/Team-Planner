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
