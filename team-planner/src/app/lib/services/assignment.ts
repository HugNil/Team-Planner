import { prisma } from '../prisma';

type AssignmentStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED';

export async function createAssignment(data: {
  matchId: string;
  playerId: string;
  position?: string;
}) {
  return prisma.assignment.create({
    data,
    include: {
      player: true,
      match: true
    }
  });
}

export async function getAssignmentsForMatch(matchId: string) {
  return prisma.assignment.findMany({
    where: { matchId },
    include: {
      player: true
    },
    orderBy: {
      player: {
        number: 'asc'
      }
    }
  });
}

export async function getAssignmentsForPlayer(playerId: string) {
  return prisma.assignment.findMany({
    where: { playerId },
    include: {
      match: true
    },
    orderBy: {
      match: {
        date: 'asc'
      }
    }
  });
}

export async function updateAssignmentStatus(id: string, status: AssignmentStatus) {
  return prisma.assignment.update({
    where: { id },
    data: { status },
    include: {
      player: true,
      match: true
    }
  });
}

export async function deleteAssignment(id: string) {
  return prisma.assignment.delete({
    where: { id }
  });
}

export async function bulkCreateAssignments(assignments: Array<{
  matchId: string;
  playerId: string;
  position?: string;
}>) {
  return prisma.assignment.createMany({
    data: assignments,
    skipDuplicates: true
  });
}

export async function getPlayerAvailability(playerId: string, fromDate: Date, toDate: Date) {
  return prisma.assignment.findMany({
    where: {
      playerId,
      match: {
        date: {
          gte: fromDate,
          lte: toDate
        }
      }
    },
    include: {
      match: true
    }
  });
}
