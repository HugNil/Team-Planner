import { NextRequest, NextResponse } from 'next/server';
import { getPlayersForClub, createPlayer, deletePlayer } from '@/app/lib/services/player';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');
    
    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }
    
    const players = await getPlayersForClub(clubId);
    return NextResponse.json(players);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, number, clubId } = body;
    
    if (!firstName || !lastName || !clubId) {
      return NextResponse.json({ 
        error: 'firstName, lastName, and clubId are required' 
      }, { status: 400 });
    }

    const player = await createPlayer({ firstName, lastName, number, clubId });
    return NextResponse.json(player, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    
    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }

    await deletePlayer(playerId);
    return NextResponse.json({ message: 'Player deleted successfully' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
