import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchSwebowlMatches } from './swebowl';

const calendar = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:match-1
DTSTART:20261010T120000Z
SUMMARY:Home - Away
END:VEVENT
END:VCALENDAR`;

test('rejects a partial team fetch instead of returning only successful teams', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) =>
    String(url).includes('/broken?')
      ? new Response('Unavailable', { status: 503 })
      : new Response(calendar),
  );

  await assert.rejects(
    fetchSwebowlMatches({ clubName: 'Test', seasonId: 2026, teamIds: ['ok', 'broken'] }),
    /Synk avbruten.*broken.*Inga matcher har ändrats/,
  );
});

test('returns all matches when both team fetches succeed', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(calendar));
  const matches = await fetchSwebowlMatches({
    clubName: 'Test', seasonId: 2026, teamIds: ['one', 'two'],
  });
  assert.deepEqual(matches.map((match) => match.externalId).sort(), [
    'swebowl-calendar-one-match-1', 'swebowl-calendar-two-match-1',
  ]);
});

test('returns an empty result for empty calendars without inventing matches', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('BEGIN:VCALENDAR\nEND:VCALENDAR'));
  assert.deepEqual(await fetchSwebowlMatches({
    clubName: 'Test', seasonId: 2026, teamIds: ['empty'],
  }), []);
});

test('rejects network failures even if another team succeeds', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    if (String(url).includes('/offline?')) throw new Error('Network unavailable');
    return new Response(calendar);
  });
  await assert.rejects(
    fetchSwebowlMatches({ clubName: 'Test', seasonId: 2026, teamIds: ['ok', 'offline'] }),
    /Synk avbruten.*offline/,
  );
});

for (const [name, content] of [
  ['HTML error with status 200', '<html>Unavailable</html>'],
  ['truncated calendar', calendar.replace('END:VCALENDAR', '')],
  ['missing stable identity', calendar.replace('UID:match-1', '')],
  ['invalid date', calendar.replace('20261010T120000Z', 'invalid')],
]) {
  test(`rejects ${name}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response(content));
    await assert.rejects(fetchSwebowlMatches({ clubName: 'Test', seasonId: 2026, teamIds: ['one'] }));
  });
}

test('a rescheduled calendar match keeps its external identity', async (t) => {
  let content = calendar;
  t.mock.method(globalThis, 'fetch', async () => new Response(content));
  const options = { clubName: 'Test', seasonId: 2026, teamIds: ['one'] };
  const [before] = await fetchSwebowlMatches(options);
  content = calendar.replace('20261010T120000Z', '20261017T140000Z');
  const [after] = await fetchSwebowlMatches(options);
  assert.equal(after.externalId, before.externalId);
  assert.equal(after.date.toISOString(), '2026-10-17T14:00:00.000Z');
});


for (const status of [401, 403]) {
  test(`falls back on HTTP ${status} using existing API match identity`, async (t) => {
    t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
      if (String(url).includes('/api/v1/Match/')) return new Response('', { status });
      if (String(url).includes('/Calendar/')) return new Response(calendar.replace('UID:match-1', 'UID:match-3306191@swebowl.se'));
      return new Response('');
    });
    const [match] = await fetchSwebowlMatches({ clubName: 'Test', seasonId: 2026, teamIds: ['158483:923'] });
    assert.equal(match.externalId, 'swebowl-match-3306191');
    assert.equal(match.sourceTeamName, '158483');
    assert.equal(match.incompleteFeed, true);
  });
}

test('failed calendar fallback aborts the sync', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }));
  await assert.rejects(fetchSwebowlMatches({ clubName: 'Test', seasonId: 2026, teamIds: ['158483:923'] }), /Synk avbruten/);
});
