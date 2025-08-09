import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    
    switch (action) {
      case 'clubs':
        const clubs = await prisma.club.findMany({
          include: {
            _count: {
              select: {
                players: true,
                matches: true,
                users: true
              }
            }
          }
        });
        return NextResponse.json(clubs);
        
      case 'players':
        const clubId = searchParams.get('clubId');
        if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });
        
        const players = await prisma.player.findMany({
          where: { clubId },
          orderBy: [{ number: 'asc' }, { lastName: 'asc' }]
        });
        return NextResponse.json(players);
        
      case 'matches':
        const matchClubId = searchParams.get('clubId');
        if (!matchClubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });
        
        const matches = await prisma.match.findMany({
          where: { clubId: matchClubId },
          include: {
            assignments: {
              include: {
                player: true
              }
            }
          },
          orderBy: { date: 'asc' }
        });
        return NextResponse.json(matches);
        
      default:
        return NextResponse.json({
          message: 'Test API endpoint',
          availableActions: ['clubs', 'players', 'matches'],
          example: '/api/test?action=clubs'
        });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
