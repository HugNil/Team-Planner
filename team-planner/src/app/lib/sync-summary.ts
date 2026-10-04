export type MatchSummary = {
  externalId: string | null;
  homeTeam: string;
  awayTeam: string;
  date: string;
  location: string | null;
};
export type SyncChange = { kind: 'added' | 'moved' | 'updated' | 'removed'; before: MatchSummary | null; after: MatchSummary | null };
export function matchSummary(match: { externalId: string | null; homeTeam: string; awayTeam: string; date: Date; location?: string | null }): MatchSummary {
  return { externalId: match.externalId, homeTeam: match.homeTeam, awayTeam: match.awayTeam, date: match.date.toISOString(), location: match.location ?? null };
}
export function describeSyncChange(before: MatchSummary | null, after: MatchSummary | null): SyncChange {
  return { kind: !before ? 'added' : !after ? 'removed' : before.date !== after.date ? 'moved' : 'updated', before, after };
}
