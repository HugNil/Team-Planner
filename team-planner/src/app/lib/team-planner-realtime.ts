type TeamPlannerSocket = WebSocket;

const shared = globalThis as typeof globalThis & {
  __teamPlannerSockets?: Map<string, Set<TeamPlannerSocket>>;
};
const socketsByClub = shared.__teamPlannerSockets ??= new Map<string, Set<TeamPlannerSocket>>();

export function subscribeTeamPlanner(clubId: string, socket: TeamPlannerSocket) {
  const sockets = socketsByClub.get(clubId) ?? new Set<TeamPlannerSocket>();
  sockets.add(socket);
  socketsByClub.set(clubId, sockets);
  socket.addEventListener('close', () => {
    sockets.delete(socket);
    if (sockets.size === 0) socketsByClub.delete(clubId);
  });
}

export function broadcastTeamPlannerUpdate(clubId: string) {
  const sockets = socketsByClub.get(clubId);
  if (!sockets) return;
  const message = JSON.stringify({ type: 'planner-updated', clubId });
  for (const socket of sockets) {
    if (socket.readyState !== 1) {
      sockets.delete(socket);
      continue;
    }
    try {
      socket.send(message);
    } catch {
      // A failed notification must not turn a committed save into an API error.
      sockets.delete(socket);
    }
  }
  if (sockets.size === 0) socketsByClub.delete(clubId);
}
