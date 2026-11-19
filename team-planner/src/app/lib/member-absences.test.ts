import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { PATCH } from '../api/member-board/route';
import { prisma } from './prisma';

function setup({ past = false, missing = false } = {}) {
  const dayMarks = new Set<string>();
  const matchMarks = new Set<string>();
  const logs: any[] = [];
  const player = { id: 'player', firstName: 'Test', lastName: 'Spelare' };
  const days = ['day1', 'day2'].map((id, i) => ({ id, dateKey: id,
    playRound: { startsOn: new Date(past ? '2020-01-01' : '2099-01-01') },
    matches: [{ id: `match${i + 1}`, homeTeam: 'F1', awayTeam: 'Borta', externalId: null, sourceTeamName: 'F1' },
      { id: `other${i + 1}`, homeTeam: 'F2', awayTeam: 'Borta', externalId: null, sourceTeamName: 'F2' }],
  }));
  const tx: any = {
    $queryRaw: async () => [],
    team: { findFirst: async ({ where }: any) => ['F1', 'F2'].includes(where.id) ? { name: where.id, swebowlTeamId: null } : null },
    player: { findFirst: async () => player, findUnique: async () => player },
    playDay: {
      findMany: async ({ where }: any) => missing ? [] : where.matches ? days.filter(d => d.matches.some(m => m.id === where.matches.some.id)) : where.id ? days.filter(d => d.id === where.id) : days,
      findFirst: async ({ where }: any) => days.find(d => d.id === where.id),
      findUnique: async ({ where }: any) => days.find(d => d.id === where.id),
    },
    match: { findFirst: async ({ where }: any) => days.find(d => d.id === where.playDayId)?.matches.find(m => m.id === where.id) },
    changeLog: {
      create: async ({ data }: any) => { logs.push({ ...data, id: String(logs.length) }); },
      findFirst: async ({ where }: any) => logs.find(l => l.id === where.id),
      update: async () => {},
    },
  };
  for (const [name, marks, key] of [['dayAbsence', dayMarks, 'playDayId'], ['absence', matchMarks, 'matchId']] as const) {
    tx[name] = {
      findUnique: async ({ where }: any) => marks.has(where[`${key}_playerId`][key]) ? { id: 'absence' } : null,
      upsert: async ({ create }: any) => { marks.add(create[key]); },
      deleteMany: async ({ where }: any) => { marks.delete(where[key]); },
    };
  }
  prisma.club.findUnique = async () => ({ id: 'club' });
  prisma.$transaction = async (callback: any) => {
    const beforeDays = [...dayMarks], beforeMatches = [...matchMarks], count = logs.length;
    try { return await callback(tx); } catch (error) {
      dayMarks.clear(); beforeDays.forEach(id => dayMarks.add(id));
      matchMarks.clear(); beforeMatches.forEach(id => matchMarks.add(id)); logs.length = count;
      throw error;
    }
  };
  return { dayMarks, matchMarks, logs };
}
function request(target: object, unavailable: unknown = true) {
  return new NextRequest('http://localhost/api/member-board', { method: 'PATCH', body: JSON.stringify({ code: 'TEST', playerId: 'player', unavailable, ...target }) });
}

test('team absence marks both matches, including on different days, and leaves other teams available', async () => {
  const state = setup();
  assert.equal((await PATCH(request({ teamId: 'F1', playRoundId: 'round' }))).status, 200);
  assert.deepEqual([...state.matchMarks], ['match1', 'match2']);
  assert.equal(state.dayMarks.size, 0);
  assert.equal(state.logs.length, 2);
  assert.equal((await PATCH(request({ teamId: 'F1', playRoundId: 'round' }, false))).status, 200);
  assert.equal(state.matchMarks.size, 0);
});
test('whole round marks and clears every day and all team choices', async () => {
  const state = setup();
  await PATCH(request({ teamId: 'F1', playRoundId: 'round' }));
  assert.equal((await PATCH(request({ playRoundId: 'round' }))).status, 200);
  assert.deepEqual([...state.dayMarks], ['day1', 'day2']);
  assert.equal((await PATCH(request({ teamId: 'F2', playRoundId: 'round' }))).status, 409);
  assert.equal((await PATCH(request({ playRoundId: 'round' }, false))).status, 200);
  assert.equal(state.dayMarks.size, 0);
  assert.equal(state.matchMarks.size, 0);
});
test('deadline and inaccessible teams reject writes', async () => {
  let state = setup({ past: true });
  assert.equal((await PATCH(request({ teamId: 'F1', playRoundId: 'round' }))).status, 403);
  assert.equal(state.logs.length, 0);
  state = setup();
  assert.equal((await PATCH(request({ teamId: 'foreign-team', playRoundId: 'round' }))).status, 404);
  assert.equal(state.logs.length, 0);
  state = setup({ missing: true });
  assert.equal((await PATCH(request({ teamId: 'F1', playRoundId: 'round' }))).status, 404);
});
test('single-match requests and ambiguous values cannot bypass team selection', async () => {
  const state = setup();
  assert.equal((await PATCH(request({ matchId: 'match1' }))).status, 400);
  assert.equal((await PATCH(request({ teamId: 'F1' }))).status, 400);
  assert.equal((await PATCH(request({ teamId: 'F1', playRoundId: 'round', playDayId: 'day1' }))).status, 400);
  assert.equal((await PATCH(request({ teamId: 'F1', playRoundId: 'round' }, 'false'))).status, 400);
  assert.equal(state.logs.length, 0);
});
test('legacy single-match absence is cleared for the entire team', async () => {
  const state = setup();
  state.matchMarks.add('match2');
  assert.equal((await PATCH(request({ teamId: 'F1', playRoundId: 'round' }, false))).status, 200);
  assert.equal(state.matchMarks.size, 0);
});
test('a blocked later day rolls back the entire team change', async () => {
  const state = setup();
  state.dayMarks.add('day2');
  assert.equal((await PATCH(request({ teamId: 'F1', playRoundId: 'round' }))).status, 409);
  assert.equal(state.matchMarks.size, 0);
  assert.equal(state.logs.length, 0);
});
