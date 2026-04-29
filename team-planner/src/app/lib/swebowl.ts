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
};

type SwebowlApiTeam = {
  teamId: number | string;
  teamName: string;
  teamDivisionId?: number;
};

type SwebowlApiMatch = {
  matchId?: number | string;
  MatchId?: number | string;
  matchHomeTeamName?: string;
  matchAwayTeamName?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  matchDateTime?: string;
  matchDatetime?: string;
  matchHallName?: string;
  hallName?: string;
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

function parseIcsDate(value: string) {
  const dateMatch = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/);

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

function parseCalendarMatches(text: string, teamId: string): SwebowlMatch[] {
  const unfolded = unfoldIcs(text);
  const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  return events.flatMap((event) => {
    const uid = getIcsField(event, 'UID') || `team-${teamId}-${getIcsField(event, 'DTSTART')}-${getIcsField(event, 'SUMMARY')}`;
    const summary = getIcsField(event, 'SUMMARY');
    const description = getIcsField(event, 'DESCRIPTION');
    const location = getIcsField(event, 'LOCATION') || undefined;
    const start = parseIcsDate(getIcsField(event, 'DTSTART'));

    if (!summary || !start) {
      return [];
    }

    const { homeTeam, awayTeam } = splitTeams(summary);

    return [{
      externalId: `swebowl-calendar-${teamId}-${uid}`,
      homeTeam,
      awayTeam,
      date: start,
      location,
      sourceTeamName: description || undefined,
    }];
  });
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
    throw new Error(`Swebowl API svarade ${response.status}`);
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

  return teams.filter((team) => normalize(team.teamName).startsWith(normalize(clubName))).slice(0, 4);
}

async function fetchMatchesFromApi(team: SwebowlApiTeam, seasonId: number) {
  const matches = await fetchJson<SwebowlApiMatch[]>('/Match', {
    teamId: team.teamId,
    divisionId: team.teamDivisionId,
    seasonId,
  });

  return matches.flatMap((match) => {
    const matchId = match.matchId ?? match.MatchId;
    const homeTeam = match.matchHomeTeamName ?? match.homeTeamName;
    const awayTeam = match.matchAwayTeamName ?? match.awayTeamName;
    const dateValue = match.matchDateTime ?? match.matchDatetime;

    if (!matchId || !homeTeam || !awayTeam || !dateValue) {
      return [];
    }

    return [{
      externalId: `swebowl-match-${matchId}`,
      homeTeam,
      awayTeam,
      date: new Date(dateValue),
      location: match.matchHallName ?? match.hallName,
      sourceTeamName: team.teamName,
    }];
  });
}

async function fetchMatchesFromCalendar(teamId: string, seasonId: number) {
  const url = `${SWEBOWL_CALENDAR_BASE}/${teamId}?seasonId=${seasonId}&nocache`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Swebowl kalender svarade ${response.status} för lag ${teamId}`);
  }

  return parseCalendarMatches(await response.text(), teamId);
}

function uniqueMatches(matches: SwebowlMatch[]) {
  return [...new Map(matches.map((match) => [match.externalId, match])).values()]
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

export async function fetchSwebowlMatches(options: {
  clubName: string;
  seasonId: number;
  teamIds?: string[];
}) {
  if (options.teamIds?.length) {
    const matches = await Promise.all(
      options.teamIds.map((teamId) => fetchMatchesFromCalendar(teamId, options.seasonId)),
    );

    return uniqueMatches(matches.flat());
  }

  const teams = await fetchTeamsFromApi(options.clubName, options.seasonId);
  const matches = await Promise.all(teams.map((team) => fetchMatchesFromApi(team, options.seasonId)));
  return uniqueMatches(matches.flat());
}
