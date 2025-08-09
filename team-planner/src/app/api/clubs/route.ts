import { NextRequest, NextResponse } from 'next/server';
import { 
  createClub, 
  getAllClubs, 
  getClubById,
  getClubByCode,
  updateClub 
} from '@/app/lib/services/club';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');
    const code = searchParams.get('code');
    
    if (clubId) {
      const club = await getClubById(clubId);
      if (!club) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }
      return NextResponse.json(club);
    }
    
    if (code) {
      const club = await getClubByCode(code);
      if (!club) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }
      return NextResponse.json(club);
    }
    
    const clubs = await getAllClubs();
    return NextResponse.json(clubs);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code } = body;
    
    if (!name || !code) {
      return NextResponse.json({ 
        error: 'name and code are required' 
      }, { status: 400 });
    }

    const club = await createClub({ name, code });
    return NextResponse.json(club, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { clubId, ...updateData } = body;
    
    if (!clubId) {
      return NextResponse.json({ 
        error: 'clubId is required' 
      }, { status: 400 });
    }

    const club = await updateClub(clubId, updateData);
    return NextResponse.json(club);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
