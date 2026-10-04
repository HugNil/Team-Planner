export type RoundLineup = {
  teamId: string;
  playDayId?: string;
  players: Array<{ playerId: string; sortOrder: number }>;
};

// Evaluate the proposed lineup after replacing the destination slot.
export function getLineupConflict(
  lineups: RoundLineup[], playerId: string, teamId: string, sortOrder?: number, playDayId?: string,
): string | null {
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const lineup of lineups) {
    for (const player of lineup.players) {
      if (lineup.teamId === teamId && (!playDayId || lineup.playDayId === playDayId) && (player.playerId === playerId || player.sortOrder === sortOrder)) continue;
      const teams = teamsByPlayer.get(player.playerId) ?? new Set<string>();
      teams.add(lineup.teamId);
      teamsByPlayer.set(player.playerId, teams);
    }
  }
  const teams = teamsByPlayer.get(playerId) ?? new Set<string>();
  teams.add(teamId);
  if (teams.size > 2) return 'Spelaren är redan uttagen i två lag i omgången.';
  for (const otherTeam of teams) {
    if (otherTeam === teamId) continue;
    for (const [otherPlayer, otherTeams] of teamsByPlayer) {
      if (otherPlayer !== playerId && otherTeams.has(teamId) && otherTeams.has(otherTeam)) {
        return 'De här lagen delar redan en annan spelare i omgången.';
      }
    }
  }
  return null;
}
