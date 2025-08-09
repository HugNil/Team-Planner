import { prisma } from '../prisma';

export async function createMatch(data: {
  homeTeam: string;
  awayTeam: string;
  date: Date;
  location?: string;
  clubId: string;
}) {
  return prisma.match.create({
    data,
    include: {
      club: true,
      assignments: {
        include: {
          player: true
        }
      }
    }
  });
}

export async function getMatchesForClub(clubId: string) {
  return prisma.match.findMany({
    where: { clubId },
    include: {
      assignments: {
        include: {
          player: true
        }
      }
    },
    orderBy: { date: 'asc' }
  });
}

export async function getMatchById(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      club: true,
      assignments: {
        include: {
          player: true
        }
      }
    }
  });
}

export async function updateMatch(id: string, data: {
  homeTeam?: string;
  awayTeam?: string;
  date?: Date;
  location?: string;
}) {
  return prisma.match.update({
    where: { id },
    data,
    include: {
      assignments: {
        include: {
          player: true
        }
      }
    }
  });
}

export async function deleteMatch(id: string) {
  return prisma.match.delete({
    where: { id }
  });
}

export async function getUpcomingMatches(clubId: string) {
  return prisma.match.findMany({
    where: {
      clubId,
      date: {
        gte: new Date()
      }
    },
    include: {
      assignments: {
        include: {
          player: true
        }
      }
    },
    orderBy: { date: 'asc' },
    take: 5
  });
}
