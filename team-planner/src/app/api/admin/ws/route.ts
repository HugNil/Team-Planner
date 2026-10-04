import { experimental_upgradeWebSocket } from '@vercel/functions';
import { requireClubAccess } from '@/app/lib/admin-auth';
import { subscribeTeamPlanner } from '@/app/lib/team-planner-realtime';

export async function GET(req: Request) {
  const clubId = new URL(req.url).searchParams.get('clubId') ?? '';
  if (!await requireClubAccess(clubId, ['ADMIN', 'UK'])) {
    return Response.json({ error: 'Saknar behörighet' }, { status: 403 });
  }
  return experimental_upgradeWebSocket((socket) => {
    subscribeTeamPlanner(clubId, socket);
    socket.send(JSON.stringify({ type: 'connected', clubId }));
  });
}
