import { requireClubAccess } from '@/app/lib/admin-auth';

export async function GET(req: Request) {
  const clubId = new URL(req.url).searchParams.get('clubId') ?? '';
  if (!await requireClubAccess(clubId, ['ADMIN', 'UK'])) {
    return Response.json({ error: 'Saknar behörighet' }, { status: 403 });
  }
  // Realtime updates use polling in the admin UI. Keep this endpoint harmless
  // for older clients that may still try to connect while they are being refreshed.
  return new Response(null, { status: 204 });
}
