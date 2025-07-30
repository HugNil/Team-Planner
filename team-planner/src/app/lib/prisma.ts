import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = 
  global.__prisma || new PrismaClient();
  new PrismaClient({ log: ['query'] });

if(process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}
