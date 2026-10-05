import assert from 'node:assert/strict';
import { test } from 'node:test';
import { swapLineupPlayers } from './lineup-swap';

const source = { teamId: 'A', playDayId: 'sat', sortOrder: 0 };
const target = { teamId: 'B', playDayId: 'sun', sortOrder: 8 };
const fixtures = () => [
  { teamId: 'A', playDayId: 'sat', players: [{ playerId: 'alice', sortOrder: 0 }, { playerId: 'bob', sortOrder: 1 }] },
  { teamId: 'B', playDayId: 'sun', players: [{ playerId: 'carol', sortOrder: 8 }] },
];
test('swaps occupied slots in the same lineup without losing either player', () => {
  const original = fixtures();
  const next = swapLineupPlayers(original, source, { ...source, sortOrder: 1 }, 'alice');
  assert.deepEqual(next[0].players, [{ playerId: 'bob', sortOrder: 0 }, { playerId: 'alice', sortOrder: 1 }]);
  assert.deepEqual(original, fixtures());
});
test('swaps across teams, days and reserve slots and can be reversed', () => {
  const original = fixtures();
  const next = swapLineupPlayers(original, source, target, 'alice');
  assert.deepEqual(next[0].players, [{ playerId: 'carol', sortOrder: 0 }, { playerId: 'bob', sortOrder: 1 }]);
  assert.deepEqual(next[1].players, [{ playerId: 'alice', sortOrder: 8 }]);
  assert.deepEqual(swapLineupPlayers(next, target, source, 'alice'), original);
});
test('dropping a player on themselves leaves the lineup unchanged', () => {
  const original = fixtures();
  assert.equal(swapLineupPlayers(original, source, source, 'alice'), original);
});
test('rejects stale source slots and empty destinations', () => {
  assert.throws(() => swapLineupPlayers(fixtures(), { ...source, sortOrder: 2 }, target, 'alice'), /ändrats/);
  assert.throws(() => swapLineupPlayers(fixtures(), source, { ...target, sortOrder: 9 }, 'alice'), /ändrats/);
});
test('does not create duplicate players within a team', () => {
  const original = fixtures();
  original[1].players.push({ playerId: 'alice', sortOrder: 0 });
  assert.throws(() => swapLineupPlayers(original, source, target, 'alice'), /redan uttagen/);
});
test('checks shared player limits for the displaced player as well', () => {
  const original = fixtures();
  original.push({ teamId: 'C', playDayId: 'sun', players: [{ playerId: 'carol', sortOrder: 0 }, { playerId: 'bob', sortOrder: 1 }] });
  assert.throws(() => swapLineupPlayers(original, source, target, 'alice'), /delar redan/);
});
test('only moves the dragged occurrence of a player selected in two teams', () => {
  const original = fixtures();
  original.push({ teamId: 'C', playDayId: 'sun', players: [{ playerId: 'alice', sortOrder: 0 }] });
  const next = swapLineupPlayers(original, source, target, 'alice');
  assert.deepEqual(next[2], original[2]);
  assert.equal(next[1].players[0].playerId, 'alice');
});
