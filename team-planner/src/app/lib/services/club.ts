import { prisma } from '../prisma';

export async function createClub(data: {
  name: string;
  code: string;
}) {
  return prisma.club.create({ 
    data: {
      name: data.name,
      code: data.code.toUpperCase(),
    }
  });
}

export async function getClubByCode(code: string) {
  return prisma.club.findUnique({ 
    where: { code: code.toUpperCase() },
    include: {
      players: true,
      users: true,
      admins: true,
    }
  });
}

export async function getClubById(id: string) {
  return prisma.club.findUnique({ 
    where: { id },
    include: {
      players: {
        orderBy: [
          { number: 'asc' },
          { lastName: 'asc' }
        ]
      },
      users: true,
      admins: true,
    }
  });
}

export async function getAllClubs() {
  return prisma.club.findMany({
    include: {
      _count: {
        select: {
          players: true,
          users: true,
        }
      }
    }
  });
}

export async function updateClub(id: string, data: {
  name?: string;
  code?: string;
}) {
  return prisma.club.update({
    where: { id },
    data: {
      ...data,
      code: data.code ? data.code.toUpperCase() : undefined,
    }
  });
}

export async function deleteClub(id: string) {
  return prisma.club.delete({ where: { id } });
}
