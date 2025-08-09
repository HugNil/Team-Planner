import { prisma } from '../prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';

export async function createUser(data: {
  email: string;
  password: string;
  role: Role;
  clubId?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  
  return prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      clubId: data.clubId,
    },
    include: {
      club: true,
      adminClubs: true,
    }
  });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      club: true,
      adminClubs: true,
    }
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      club: true,
      adminClubs: true,
    }
  });
}

export async function updateUser(id: string, data: {
  email?: string;
  role?: Role;
  clubId?: string;
}) {
  return prisma.user.update({
    where: { id },
    data: {
      ...data,
      email: data.email ? data.email.toLowerCase() : undefined,
    },
    include: {
      club: true,
      adminClubs: true,
    }
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export async function validatePassword(user: { passwordHash: string }, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}

export async function assignUserToClub(userId: string, clubId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { clubId },
    include: { club: true }
  });
}

export async function makeUserClubAdmin(userId: string, clubId: string) {
  return prisma.club.update({
    where: { id: clubId },
    data: {
      admins: {
        connect: { id: userId }
      }
    }
  });
}
