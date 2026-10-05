import { getLineupConflict, type RoundLineup } from './lineup-eligibility';

export type LineupSlot = { teamId: string; playDayId: string; sortOrder: number };

// Keep the source explicit: a player may be selected in more than one team.
export function swapLineupPlayers<T extends RoundLineup>(lineups: T[], source: LineupSlot, target: LineupSlot, playerId: string) {
  const matches = (lineup: T, slot: LineupSlot) => lineup.teamId === slot.teamId && lineup.playDayId === slot.playDayId;
  const from = lineups.find((lineup) => matches(lineup, source));
  const to = lineups.find((lineup) => matches(lineup, target));
  const first = from?.players.find((player) => player.sortOrder === source.sortOrder && player.playerId === playerId);
  const second = to?.players.find((player) => player.sortOrder === target.sortOrder);
  if (!first || !second) throw new Error('Laguttagningen har ändrats. Ladda om och försök igen.');
  if (first.playerId === second.playerId) return lineups;
  const next = lineups.map((lineup) => ({
    ...lineup,
    players: lineup.players.map((player) => {
      if (matches(lineup, source) && player.sortOrder === source.sortOrder) return { ...second, sortOrder: source.sortOrder };
      if (matches(lineup, target) && player.sortOrder === target.sortOrder) return { ...first, sortOrder: target.sortOrder };
      return player;
    }),
  }));
  for (const lineup of next) {
    if (new Set(lineup.players.map((player) => player.playerId)).size !== lineup.players.length) {
      throw new Error('Spelaren är redan uttagen i det laget.');
    }
    for (const player of lineup.players) {
      const conflict = getLineupConflict(next, player.playerId, lineup.teamId, player.sortOrder, lineup.playDayId);
      if (conflict) throw new Error(conflict);
    }
  }
  return next as T[];
}
