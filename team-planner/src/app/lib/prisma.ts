const { PrismaClient } = require('@prisma/client');

type PrismaClientType = typeof PrismaClient;

declare global {
  var __prisma: InstanceType<PrismaClientType> | undefined;
}

export const prisma = 
  global.__prisma || new PrismaClient({ log: ['query'] });

if(process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}
