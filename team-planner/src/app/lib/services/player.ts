import { prisma } from '../prisma';

export async function getPlayersForClub(clubId: string) {
  return prisma.player.findMany({ where: { clubId } });
}

export async function createPlayer(data: {
  firstName: string;
  lastName: string;
  number?: number;
  clubId: string;
}) {
  return prisma.player.create({ data });
}

export async function deletePlayer(id: string) {
  return prisma.player.delete({ where: { id } });
}
