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
