import bcrypt from 'bcryptjs';
import { prisma } from '../src/app/lib/prisma';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const clubId = process.env.ADMIN_CLUB_ID?.trim();
  const clubName = process.env.ADMIN_CLUB_NAME?.trim() ?? 'BK Allön';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const club = clubId
    ? await prisma.club.findUnique({ where: { id: clubId } })
    : await prisma.club.findFirst({ where: { name: clubName } });

  if (!club) {
    throw new Error(`Club not found. Set ADMIN_CLUB_ID or ADMIN_CLUB_NAME. Tried: ${clubName}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: 'SUPERADMIN',
      clubId: club.id,
    },
    update: {
      passwordHash,
      role: 'SUPERADMIN',
      clubId: club.id,
    },
  });

  await prisma.clubMembership.upsert({
    where: {
      userId_clubId: {
        userId: user.id,
        clubId: club.id,
      },
    },
    create: {
      userId: user.id,
      clubId: club.id,
      role: 'ADMIN',
    },
    update: {
      role: 'ADMIN',
    },
  });

  console.log(`Admin ready: ${email} for ${club.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
