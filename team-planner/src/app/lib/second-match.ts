type PlayerSlot = { playerId: string; sortOrder: number };

// Preserve match 2 positions when match 1 is reordered. New players fill vacant positions.
export function preserveSecondMatch(slots: number[], before: PlayerSlot[], after: PlayerSlot[]): number[] {
  if (!slots.length) return [];
  const result = slots.map((source) => {
    const player = before.find((item) => item.sortOrder === source);
    return player ? after.find((item) => item.playerId === player.playerId)?.sortOrder : undefined;
  });
  const available = slots.filter((source) => !result.includes(source));
  return result.map((source) => source ?? available.shift()!);
}
