import { NextRequest, NextResponse } from 'next/server';
import { getClubDashboard, getPlayerStats } from '@/app/lib/services/dashboard';
import { handleApiError } from '@/app/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId');
    const playerId = searchParams.get('playerId');
    
    if (playerId) {
      const stats = await getPlayerStats(playerId);
      return NextResponse.json(stats);
    }
    
    if (clubId) {
      const dashboard = await getClubDashboard(clubId);
      return NextResponse.json(dashboard);
    }
    
    return NextResponse.json({ 
      error: 'Either clubId or playerId is required' 
    }, { status: 400 });
    
  } catch (error) {
    return handleApiError(error);
  }
}
