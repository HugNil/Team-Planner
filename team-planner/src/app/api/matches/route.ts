import { NextRequest, NextResponse } from 'next/server';
import { 
  createMatch, 
  getMatchesForClub, 
  getUpcomingMatches 
} from '@/app/lib/services/match';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');
    const upcoming = searchParams.get('upcoming') === 'true';
    
    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    let matches;
    if (upcoming) {
      matches = await getUpcomingMatches(clubId);
    } else {
      matches = await getMatchesForClub(clubId);
    }

    return NextResponse.json(matches);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { homeTeam, awayTeam, date, location, clubId } = body;
    
    if (!homeTeam || !awayTeam || !date || !clubId) {
      return NextResponse.json({ 
        error: 'homeTeam, awayTeam, date, and clubId are required' 
      }, { status: 400 });
    }

    const match = await createMatch({
      homeTeam,
      awayTeam,
      date: new Date(date),
      location,
      clubId
    });

    return NextResponse.json(match, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}