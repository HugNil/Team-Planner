import { prisma } from '../prisma';

export async function createJoinRequest(email: string, name: string, clubId: string) {
  return prisma.joinRequest.create({
    data: { email, name, clubId, status: 'PENDING' }
  });
}

export async function listPending(clubId: string) {
  return prisma.joinRequest.findMany({
    where: { clubId, status: 'PENDING' }
  });
}
export async function approveRequest(id: string) {
  return prisma.joinRequest.update({
    where: { id },
    data: { status: 'APPROVED' }
  });
}
