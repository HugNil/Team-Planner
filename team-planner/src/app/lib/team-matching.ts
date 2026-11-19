function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function matchBelongsToTeam(
  match: { externalId: string | null; sourceTeamName: string | null; homeTeam: string; awayTeam: string },
  team: { name: string; swebowlTeamId: string | null },
) {
  const teamId = team.swebowlTeamId ? normalize(team.swebowlTeamId.split(':')[0]) : '';
  const teamName = normalize(team.name);
  const externalId = normalize(match.externalId);
  const sourceTeamName = normalize(match.sourceTeamName);
  const homeTeam = normalize(match.homeTeam);
  const awayTeam = normalize(match.awayTeam);

  if (teamId) {
    return externalId.includes(teamId) || sourceTeamName === teamId || sourceTeamName.includes(teamId);
  }

  return Boolean(teamName && (sourceTeamName.includes(teamName) || homeTeam.includes(teamName) || awayTeam.includes(teamName)));
}

