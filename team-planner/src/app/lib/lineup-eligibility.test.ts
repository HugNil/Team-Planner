import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLineupConflict } from './lineup-eligibility';
const lineups = [
  { teamId: 'A', players: [{ playerId: 'a1', sortOrder: 0 }, { playerId: 'a2', sortOrder: 1 }] },
  { teamId: 'F1', players: [{ playerId: 'a1', sortOrder: 0 }, { playerId: 'f1', sortOrder: 1 }] },
  { teamId: 'F2', players: [] },
];
test('another A player can double in F2 after A and F1 share a player', () => {
  assert.equal(getLineupConflict(lineups, 'a2', 'F2', 0), null);
});
test('blocks a second shared player between the same teams', () => {
  assert.ok(getLineupConflict(lineups, 'a2', 'F1', 2));
});
test('allows replacing the shared player in the target slot', () => {
  assert.equal(getLineupConflict(lineups, 'a2', 'F1', 0), null);
});
test('prevents selection in a third team', () => {
  assert.ok(getLineupConflict(lineups, 'a1', 'F2', 0));
});
test('allows all three separate pairings in the user example', () => {
  const next = [...lineups.slice(0, 2), { teamId: 'F2', players: [{ playerId: 'a2', sortOrder: 0 }] }];
  assert.equal(getLineupConflict(next, 'f1', 'F2', 1), null);
});
test('moving within an existing team does not count as another overlap', () => {
  assert.equal(getLineupConflict(lineups, 'a1', 'A', 3), null);
});
