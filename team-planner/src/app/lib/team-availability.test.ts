import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import { getMatchAbsenceConflict, getTeamAbsenceConflict } from './team-availability';

const matches = [
  { homeTeam: 'Team A', awayTeam: 'Opponent 1', sourceTeamName: 'Team A', externalId: null, absences: [{ playerId: 'absent' }], playDay: { absences: [] } },
  { homeTeam: 'Team B', awayTeam: 'Opponent 2', sourceTeamName: 'Team B', externalId: null, absences: [], playDay: { absences: [] } },
];
function database(dayAbsences: { playerId: string }[] = []) {
  return {
    playDay: { findFirst: async ({ where }: { where: { clubId: string } }) => {
      assert.equal(where.clubId, 'club');
      return { playRoundId: 'round', absences: dayAbsences };
    } },
    team: { findFirst: async ({ where }: { where: { id: string; clubId: string } }) => {
      assert.equal(where.clubId, 'club');
      return { name: `Team ${where.id}`, swebowlTeamId: null };
    } },
    match: { findMany: async ({ where }: { where: unknown }) => {
      assert.deepEqual(where, { clubId: 'club', playDay: { playRoundId: 'round' } });
      return matches;
    } },
  } as unknown as Prisma.TransactionClient;
}
test('match absence blocks the affected team, but permits another match on the same day', async () => {
  const tx = database();
  assert.match((await getTeamAbsenceConflict(tx, 'club', 'day', 'A', ['absent']))!, /Team A - Opponent 1/);
  assert.equal(await getTeamAbsenceConflict(tx, 'club', 'day', 'B', ['absent']), null);
  assert.equal(await getTeamAbsenceConflict(tx, 'club', 'day', 'A', ['available']), null);
});
test('whole-day absence still blocks all teams', async () => {
  const tx = database([{ playerId: 'absent' }]);
  assert.match((await getTeamAbsenceConflict(tx, 'club', 'day', 'B', ['absent']))!, /den dagen/);
});
test('shared roster checks the second match and reserves as well as starters', () => {
  assert.match(getMatchAbsenceConflict([matches[1], matches[0]], ['starter', 'absent'])!, /Opponent 1/);
  assert.equal(getMatchAbsenceConflict([matches[1]], ['absent']), null);
});
test('day absence on a later match day is respected', () => {
  assert.match(getMatchAbsenceConflict([{ ...matches[1], playDay: { absences: [{ playerId: 'absent' }] } }], ['absent'])!, /Team B/);
});
