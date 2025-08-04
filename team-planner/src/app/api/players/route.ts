import { NextRequest, NextResponse } from 'next/server';
import { getPlayersForClub, createPlayer } from '@/app/lib/services/player';

export async function GET(req: NextRequest) {
  // TODO: Implement proper session handling for App Router
  const { searchParams } = new URL(req.url);
  const clubId = searchParams.get('clubId');
  if (!clubId) return NextResponse.json([], { status: 200 });
  const players = await getPlayersForClub(clubId);
  return NextResponse.json(players);
}

export async function POST(req: NextRequest) {
  // TODO: Implement proper session handling for App Router
  const body = await req.json();
  if (!body.clubId) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 });
  }
  const player = await createPlayer(body);
  return NextResponse.json(player, { status: 201 });
}
