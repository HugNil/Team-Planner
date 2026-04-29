import { PrismaClient } from '@prisma/client';

declare global {
  // Allow a global var for dev to avoid creating multiple clients during HMR
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Use `globalThis` to be safe across environments and avoid bundler/global issues.
// Cast to `any` when accessing the global to avoid TS issues in some configs.
const client =
  (globalThis as any).__prisma ??
  new PrismaClient({
    log: process.env.DEBUG_PRISMA === 'true' ? ['query'] : [],
  });

if (process.env.NODE_ENV === 'development') {
  (globalThis as any).__prisma = client;
}

export const prisma = client;
