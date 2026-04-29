import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './prisma';

export async function getAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        include: { club: true },
      },
      adminClubs: true,
    },
  });

  if (!user) {
    return null;
  }

  const clubsById = new Map<string, { id: string; name: string; role: 'ADMIN' | 'UK' }>();

  for (const membership of user.memberships) {
    clubsById.set(membership.club.id, {
      id: membership.club.id,
      name: membership.club.name,
      role: membership.role,
    });
  }

  for (const club of user.adminClubs) {
    clubsById.set(club.id, {
      id: club.id,
      name: club.name,
      role: 'ADMIN',
    });
  }

  const clubs = [...clubsById.values()];

  if (user.role !== 'SUPERADMIN' && clubs.length === 0) {
    return null;
  }

  if (user.role === 'SUPERADMIN') {
    const allClubs = await prisma.club.findMany({
      orderBy: { name: 'asc' },
    });

    const adminClubs = [];

    for (const club of allClubs) {
      adminClubs.push({
        id: club.id,
        name: club.name,
        role: 'ADMIN' as const,
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      clubs: adminClubs,
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    clubs,
  };
}

export async function requireClubAccess(clubId: string, roles: Array<'ADMIN' | 'UK'> = ['ADMIN', 'UK']) {
  const adminSession = await getAdminSession();

  if (!adminSession) {
    return null;
  }

  let club = null;

  for (const item of adminSession.clubs) {
    if (item.id === clubId) {
      club = item;
      break;
    }
  }

  if (!club || !roles.includes(club.role)) {
    return null;
  }

  return { ...adminSession, activeClub: club };
}
