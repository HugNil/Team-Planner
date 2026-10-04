import type { SyncChange } from '@/app/lib/sync-summary';
const dateTime = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' });
const labels = { added: 'Ny match', moved: 'Flyttad match', updated: 'Uppdaterad match', removed: 'Borttagen match' };
export function SyncChanges({ changes }: { changes: SyncChange[] }) {
  if (!changes.length) return <p className="text-sm text-slate-600">Inga matchändringar.</p>;
  return <ul className="mt-2 space-y-2">{changes.map((change, index) => {
    const match = change.after ?? change.before;
    if (!match) return null;
    return <li key={`${match.externalId}-${index}`} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <p className="font-semibold">{labels[change.kind]}: {match.homeTeam} – {match.awayTeam}</p>
      {change.before && <p>Före: {dateTime.format(new Date(change.before.date))} · {change.before.location || 'Hall saknas'}</p>}
      {change.after && <p>{change.before ? 'Efter' : 'Datum'}: {dateTime.format(new Date(change.after.date))} · {change.after.location || 'Hall saknas'}</p>}
      {change.before && change.after && (change.before.homeTeam !== change.after.homeTeam || change.before.awayTeam !== change.after.awayTeam) && <p>Tidigare lag: {change.before.homeTeam} – {change.before.awayTeam}</p>}
    </li>;
  })}</ul>;
}
