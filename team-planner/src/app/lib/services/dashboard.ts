import { prisma } from '../prisma';

export async function getClubDashboard(clubId: string) {
  const [
    club,
    playersCount,
    upcomingMatches,
    pendingRequests,
    recentMatches
  ] = await Promise.all([
    prisma.club.findUnique({
      where: { id: clubId },
      include: {
        _count: {
          select: {
            players: true,
            users: true,
          }
        }
      }
    }),
    
    prisma.player.count({
      where: { clubId }
    }),
    
    prisma.match.findMany({
      where: {
        clubId,
        date: {
          gte: new Date()
        }
      },
      include: {
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: { date: 'asc' },
      take: 3
    }),
    
    prisma.joinRequest.count({
      where: {
        clubId,
        status: 'PENDING'
      }
    }),
    
    prisma.match.findMany({
      where: {
        clubId,
        date: {
          lt: new Date()
        }
      },
      orderBy: { date: 'desc' },
      take: 3
    })
  ]);

  return {
    club,
    stats: {
      playersCount,
      pendingRequests,
      upcomingMatchesCount: upcomingMatches.length,
      recentMatchesCount: recentMatches.length
    },
    upcomingMatches: upcomingMatches.map((match: any) => ({
      ...match,
      assignedPlayersCount: match._count.assignments,
      displayName: `${match.homeTeam} vs ${match.awayTeam}`
    })),
    recentMatches: recentMatches.map((match: any) => ({
      ...match,
      displayName: `${match.homeTeam} vs ${match.awayTeam}`
    }))
  };
}

export async function getPlayerStats(playerId: string) {
  const [
    player,
    totalMatches,
    confirmedMatches,
    pendingMatches
  ] = await Promise.all([
    prisma.player.findUnique({
      where: { id: playerId },
      include: { club: true }
    }),
    
    prisma.assignment.count({
      where: { playerId }
    }),
    
    prisma.assignment.count({
      where: {
        playerId,
        status: 'CONFIRMED'
      }
    }),
    
    prisma.assignment.count({
      where: {
        playerId,
        status: 'PENDING'
      }
    })
  ]);

  return {
    player,
    stats: {
      totalMatches,
      confirmedMatches,
      pendingMatches,
      confirmationRate: totalMatches > 0 ? (confirmedMatches / totalMatches) * 100 : 0
    }
  };
}
