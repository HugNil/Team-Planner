const SWEBOWL_API_BASE = 'https://api.swebowl.se/api/v1';
const SWEBOWL_CALENDAR_BASE = 'https://api.swebowl.se/v1/Calendar/Team';
const SWEBOWL_API_KEY = process.env.SWEBOWL_API_KEY ?? '62fcl8gPUMXSQGW1t2Y8mc2zeTk97vbd';

export type SwebowlMatch = {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  date: Date;
  location?: string;
  sourceTeamName?: string;
  roundNumber?: number;
  // Calendar feeds omit past matches and cannot authorize deletions.
  incompleteFeed?: boolean;
};

type SwebowlApiTeam = {
  teamId: number | string;
  teamName: string;
  teamDivisionId?: number;
  divisionId?: number | string;
};

type SwebowlApiMatch = {
  matchId?: number | string;
  MatchId?: number | string;
  matchRoundId?: number | string;
  matchHomeTeamName?: string;
  matchAwayTeamName?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  matchDateTime?: string;
  matchDatetime?: string;
  matchHallName?: string;
  hallName?: string;
};

type SwebowlTeamRef = {
  teamId: string;
  divisionId?: string;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, '');
}

function decodeIcsValue(value: string) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function getIcsField(event: string, fieldName: string) {
  const match = event.match(new RegExp(`^${fieldName}(?:;[^:]*)?:(.*)$`, 'im'));
  return match ? decodeIcsValue(match[1]) : '';
}

function getCookieHeader(cookies: string[]) {
  return cookies.map((cookie) => cookie.split(';')[0]).filter(Boolean).join('; ');
}

function parseIcsDate(value: string) {
  const dateMatch = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);

  if (!dateMatch) {
    return null;
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = dateMatch;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
}

function splitTeams(summary: string) {
  const cleaned = summary.replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(/\s+(?:-|–|—|vs\.?|mot)\s+/i);

  if (parts.length >= 2) {
    return {
      homeTeam: parts[0].trim(),
      awayTeam: parts.slice(1).join(' - ').trim(),
    };
  }

  return {
    homeTeam: cleaned,
    awayTeam: 'Okänt motstånd',
  };
}

function parseCalendarMatches(text: string, teamId: string, useApiIds = false): SwebowlMatch[] {
  const unfolded = unfoldIcs(text);
  if (!/^BEGIN:VCALENDAR\s*$/m.test(unfolded) || !/^END:VCALENDAR\s*$/m.test(unfolded)) {
    throw new Error('Ogiltig eller ofullständig Swebowl-kalender');
  }
  const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  if ((unfolded.match(/BEGIN:VEVENT/g) ?? []).length !== events.length) {
    throw new Error('Ofullständig Swebowl-kalender');
  }

  return events.flatMap((event) => {
    const uid = getIcsField(event, 'UID');
    const summary = getIcsField(event, 'SUMMARY');
    const description = getIcsField(event, 'DESCRIPTION');
    const location = getIcsField(event, 'LOCATION') || undefined;
    const start = parseIcsDate(getIcsField(event, 'DTSTART'));

    if (!uid || !summary || !start || !Number.isFinite(start.getTime())) {
      throw new Error('Swebowl-match saknar stabilt ID, giltigt datum eller lagnamn');
    }

    const apiMatchId = uid.match(/^match-(\d+)@swebowl\.se$/i)?.[1];
    if (useApiIds && !apiMatchId) {
      throw new Error('Kalendern saknar match-ID som kan kopplas till befintliga matcher');
    }
    const { homeTeam, awayTeam } = splitTeams(summary);

    return [{
      externalId: useApiIds ? `swebowl-match-${apiMatchId}` : `swebowl-calendar-${teamId}-${uid}`,
      incompleteFeed: true,
      homeTeam,
      awayTeam,
      date: start,
      location,
      sourceTeamName: useApiIds ? teamId : description || undefined,
    }];
  });
}

class SwebowlHttpError extends Error {
  constructor(readonly status: number) { super(`Swebowl API svarade ${status}`); }
}

function blockedApiFallback(error: unknown): null {
  if (error instanceof SwebowlHttpError && [401, 403].includes(error.status)) return null;
  throw error;
}

async function fetchJson<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${SWEBOWL_API_BASE}${path}`);
  url.searchParams.set('APIKey', SWEBOWL_API_KEY);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Referer: 'https://bits.swebowl.se/seriespel',
      Origin: 'https://bits.swebowl.se',
      'User-Agent': 'Mozilla/5.0',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new SwebowlHttpError(response.status);
  }

  return response.json() as Promise<T>;
}

async function fetchBitsCookies(teamRef?: SwebowlTeamRef, seasonId?: number) {
  const pageUrl = new URL('https://bits.swebowl.se/seriespel');
  pageUrl.searchParams.set('seasonId', String(seasonId ?? 2026));
  pageUrl.searchParams.set('clubId', '6762');

  if (teamRef?.teamId) {
    pageUrl.searchParams.set('teamId', teamRef.teamId);
  }

  if (teamRef?.divisionId) {
    pageUrl.searchParams.set('divisionId', teamRef.divisionId);
  }

  pageUrl.searchParams.set('showTeamGames', 'true');
  pageUrl.searchParams.set('showTeamDetails', 'true');

  const response = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });

  if (!response.ok) {
    return '';
  }

  return getCookieHeader(response.headers.getSetCookie?.() ?? []);
}

async function fetchJsonWithBitsCookies<T>(path: string, params: Record<string, string | number | undefined>, teamRef?: SwebowlTeamRef, seasonId?: number) {
  const url = new URL(`${SWEBOWL_API_BASE}${path}`);
  url.searchParams.set('APIKey', SWEBOWL_API_KEY);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const cookie = await fetchBitsCookies(teamRef, seasonId);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Referer: 'https://bits.swebowl.se/seriespel',
      Origin: 'https://bits.swebowl.se',
      'User-Agent': 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new SwebowlHttpError(response.status);
  }

  return response.json() as Promise<T>;
}

async function fetchTeamsFromApi(clubName: string, seasonId: number) {
  const clubs = await fetchJson<Array<{ clubId: number | string; clubName: string }>>('/Club');
  const targetClub = clubs.find((club) => normalize(club.clubName).includes(normalize(clubName)));

  if (!targetClub) {
    return [];
  }

  const teams = await fetchJson<SwebowlApiTeam[]>('/Team', {
    clubId: targetClub.clubId,
    seasonId,
  });

  return teams.filter((team) => normalize(team.teamName).startsWith(normalize(clubName)));
}

async function fetchMatchesFromApi(team: SwebowlApiTeam, seasonId: number) {
  const teamRef = {
    teamId: String(team.teamId),
    divisionId: team.teamDivisionId ? String(team.teamDivisionId) : team.divisionId ? String(team.divisionId) : undefined,
  };
  const matches = await fetchJsonWithBitsCookies<SwebowlApiMatch[]>('/Match/', {
    teamId: teamRef.teamId,
    divisionId: teamRef.divisionId,
    seasonId,
  }, teamRef, seasonId).catch(blockedApiFallback);

  if (matches === null) return fetchMatchesFromCalendar(teamRef.teamId, seasonId, true);

  return matches.flatMap((match) => {
    const matchId = match.matchId ?? match.MatchId;
    const homeTeam = match.matchHomeTeamName ?? match.homeTeamName;
    const awayTeam = match.matchAwayTeamName ?? match.awayTeamName;
    const dateValue = match.matchDateTime ?? match.matchDatetime;

    if (!matchId || !homeTeam || !awayTeam || !dateValue || !Number.isFinite(new Date(dateValue).getTime())) {
      throw new Error('Swebowl-match saknar stabilt ID, giltigt datum eller lagnamn');
    }

    return [{
      externalId: `swebowl-match-${matchId}`,
      homeTeam,
      awayTeam,
      date: new Date(dateValue),
      location: match.matchHallName ?? match.hallName,
      sourceTeamName: team.teamName,
      roundNumber: match.matchRoundId ? Number(match.matchRoundId) : undefined,
    }];
  });
}

async function fetchMatchesFromApiTeamRef(teamRef: SwebowlTeamRef, seasonId: number) {
  if (!teamRef.divisionId) {
    return fetchMatchesFromCalendar(teamRef.teamId, seasonId);
  }

  const matches = await fetchJsonWithBitsCookies<SwebowlApiMatch[]>('/Match/', {
    teamId: teamRef.teamId,
    divisionId: teamRef.divisionId,
    seasonId,
  }, teamRef, seasonId).catch(blockedApiFallback);

  if (matches === null) return fetchMatchesFromCalendar(teamRef.teamId, seasonId, true);

  return matches.flatMap((match) => {
    const matchId = match.matchId ?? match.MatchId;
    const homeTeam = match.matchHomeTeamName ?? match.homeTeamName;
    const awayTeam = match.matchAwayTeamName ?? match.awayTeamName;
    const dateValue = match.matchDateTime ?? match.matchDatetime;

    if (!matchId || !homeTeam || !awayTeam || !dateValue || !Number.isFinite(new Date(dateValue).getTime())) {
      throw new Error('Swebowl-match saknar stabilt ID, giltigt datum eller lagnamn');
    }

    return [{
      externalId: `swebowl-match-${matchId}`,
      homeTeam,
      awayTeam,
      date: new Date(dateValue),
      location: match.matchHallName ?? match.hallName,
      sourceTeamName: teamRef.teamId,
      roundNumber: match.matchRoundId ? Number(match.matchRoundId) : undefined,
    }];
  });
}

async function fetchMatchesFromCalendar(teamId: string, seasonId: number, useApiIds = false) {
  const url = `${SWEBOWL_CALENDAR_BASE}/${teamId}?seasonId=${seasonId}&nocache`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Swebowl kalender svarade ${response.status} för lag ${teamId}`);
  }

  return parseCalendarMatches(await response.text(), teamId, useApiIds);
}

function uniqueMatches(matches: SwebowlMatch[]) {
  const byExternalId = new Map<string, SwebowlMatch>();

  for (const match of matches) {
    const existing = byExternalId.get(match.externalId);

    if (!existing) {
      byExternalId.set(match.externalId, match);
      continue;
    }

    const sourceTeamNames = new Set(
      [existing.sourceTeamName, match.sourceTeamName]
        .flatMap((value) => value?.split(',') ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    );

    byExternalId.set(match.externalId, {
      ...existing,
      incompleteFeed: existing.incompleteFeed || match.incompleteFeed,
      sourceTeamName: sourceTeamNames.size > 0 ? [...sourceTeamNames].join(',') : existing.sourceTeamName,
      roundNumber: existing.roundNumber ?? match.roundNumber,
    });
  }

  return [...byExternalId.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
}

export async function fetchSwebowlMatches(options: {
  clubName: string;
  seasonId: number;
  teamIds?: Array<string | SwebowlTeamRef>;
}) {
  if (options.teamIds?.length) {
    const teamRefs = options.teamIds.map((item) => {
      if (typeof item !== 'string') {
        return item;
      }

      const [teamId, divisionId] = item.split(':').map((part) => part.trim()).filter(Boolean);
      return { teamId, divisionId };
    }).filter((item) => item.teamId);
    const results = await Promise.allSettled(
      teamRefs.map((teamRef) => fetchMatchesFromApiTeamRef(teamRef, options.seasonId)),
    );
    const failedTeams = results.flatMap((result, index) =>
      result.status === 'rejected' ? [teamRefs[index].teamId] : [],
    );

    if (failedTeams.length > 0) {
      throw new Error(`Synk avbruten: kunde inte hämta matcher för lag ${failedTeams.join(', ')}. Inga matcher har ändrats. Försök igen.`);
    }

    const matches = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

    return uniqueMatches(matches);
  }

  const teams = await fetchTeamsFromApi(options.clubName, options.seasonId);
  const matches = await Promise.all(teams.map((team) => fetchMatchesFromApi(team, options.seasonId)));
  return uniqueMatches(matches.flat());
}
