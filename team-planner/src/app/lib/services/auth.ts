import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { Role } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateUserData {
  email: string;
  password: string;
  role?: Role;
  clubId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class AuthService {
  async createUser(userData: CreateUserData) {
    const { email, password, role = Role.SELECTOR, clubId } = userData;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        clubId
      },
      include: {
        club: true,
        adminClubs: true
      }
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      clubId: user.clubId,
      clubName: user.club?.name
    };
  }

  async verifyCredentials(credentials: LoginCredentials) {
    const { email, password } = credentials;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        club: true,
        adminClubs: true
      }
    });

    if (!user) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      clubId: user.clubId,
      clubName: user.club?.name,
      isAdmin: user.adminClubs.length > 0 || user.role === 'SUPERADMIN'
    };
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        club: true,
        adminClubs: true
      }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      clubId: user.clubId,
      clubName: user.club?.name,
      isAdmin: user.adminClubs.length > 0 || user.role === 'SUPERADMIN'
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValidOldPassword = await bcrypt.compare(oldPassword, user.passwordHash);
    
    if (!isValidOldPassword) {
      throw new Error('Invalid old password');
    }

    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash
      }
    });

    return true;
  }
}

export const authService = new AuthService();