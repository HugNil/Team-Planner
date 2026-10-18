import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preserveSecondMatch } from './second-match';

const slots = [8, 1, 2, 3, 4, 5, 6, 7, 0, 9];
test('match 2 keeps its starter and reserve when match 1 swaps them', () => {
  const result = preserveSecondMatch(slots,
    [{ playerId: 'a', sortOrder: 0 }, { playerId: 'b', sortOrder: 8 }],
    [{ playerId: 'a', sortOrder: 8 }, { playerId: 'b', sortOrder: 0 }]);
  assert.equal(result[0], 0);
  assert.equal(result[8], 8);
  assert.equal(new Set(result).size, 10);
});
test('replacement players fill vacant positions without duplicating the roster', () => {
  const result = preserveSecondMatch(slots,
    [{ playerId: 'a', sortOrder: 0 }, { playerId: 'b', sortOrder: 8 }],
    [{ playerId: 'c', sortOrder: 0 }, { playerId: 'b', sortOrder: 8 }]);
  assert.equal(result[0], 8);
  assert.equal(new Set(result).size, 10);
  assert.deepEqual([...result].sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i));
});
test('a single lineup stays single', () => {
  assert.deepEqual(preserveSecondMatch([], [], []), []);
});
