import { prisma } from '../src/app/lib/prisma';
import { getPlayDayKey, getPlayRoundInfo } from '../src/app/lib/rounds';
import bcrypt from 'bcryptjs';

async function ensureMatch(data: {
  clubId: string;
  homeTeam: string;
  awayTeam: string;
  date: Date;
  location: string;
  externalId: string;
  sourceTeamName: string;
}) {
  const dateKey = getPlayDayKey(data.date);
  const roundInfo = getPlayRoundInfo(data.date);
  const playRound = await prisma.playRound.upsert({
    where: {
      clubId_roundKey: {
        clubId: data.clubId,
        roundKey: roundInfo.roundKey,
      },
    },
    create: {
      clubId: data.clubId,
      roundKey: roundInfo.roundKey,
      title: roundInfo.title,
      startsOn: roundInfo.startsOn,
      endsOn: roundInfo.endsOn,
    },
    update: {
      startsOn: roundInfo.startsOn,
      endsOn: roundInfo.endsOn,
    },
  });
  const playDay = await prisma.playDay.upsert({
    where: {
      clubId_dateKey: {
        clubId: data.clubId,
        dateKey,
      },
    },
    create: {
      clubId: data.clubId,
      playRoundId: playRound.id,
      dateKey,
      date: new Date(`${dateKey}T00:00:00`),
    },
    update: {
      playRoundId: playRound.id,
      date: new Date(`${dateKey}T00:00:00`),
    },
  });

  await prisma.match.upsert({
    where: {
      clubId_externalId: {
        clubId: data.clubId,
        externalId: data.externalId,
      },
    },
    create: {
      clubId: data.clubId,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      date: data.date,
      location: data.location,
      source: 'MANUAL',
      externalId: data.externalId,
      sourceTeamName: data.sourceTeamName,
      playDayId: playDay.id,
    },
    update: {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      date: data.date,
      location: data.location,
      sourceTeamName: data.sourceTeamName,
      playDayId: playDay.id,
    },
  });
}

async function main() {
  const club = await prisma.club.upsert({
    where: { name: 'BK Allön' },
    create: {
      name: 'BK Allön',
      code: 'BKALLON_UUID_ONLY',
      swebowlClub: 'BK Allön',
      swebowlSeason: 2025,
      swebowlTeamIds: '158483,160183,185282',
    },
    update: {
      code: 'BKALLON_UUID_ONLY',
      swebowlClub: 'BK Allön',
      swebowlSeason: 2025,
      swebowlTeamIds: '158483,160183,185282',
    },
  });

  const teams = [
    { name: 'A-lag', swebowlTeamId: '158483', sortOrder: 0 },
    { name: 'F-lag', swebowlTeamId: '160183', sortOrder: 1 },
    { name: 'B-lag', swebowlTeamId: '185282', sortOrder: 2 },
  ];

  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        clubId_name: {
          clubId: club.id,
          name: team.name,
        },
      },
      create: {
        clubId: club.id,
        ...team,
      },
      update: {
        swebowlTeamId: team.swebowlTeamId,
        sortOrder: team.sortOrder,
      },
    });
  }

  const mockClub = await prisma.club.upsert({
    where: { code: 'TEST' },
    create: {
      name: 'Mockad testklubb',
      code: 'TEST',
      swebowlClub: 'Mockad testklubb',
      swebowlSeason: 2025,
      swebowlTeamIds: null,
    },
    update: {
      name: 'Mockad testklubb',
      swebowlClub: 'Mockad testklubb',
      swebowlSeason: 2025,
      swebowlTeamIds: null,
    },
  });

  for (const name of ['Hugo Nilsson', 'Anna Andersson', 'Emma Karlsson', 'Erik Svensson']) {
    const [firstName, ...lastNameParts] = name.split(' ');
    await prisma.player.upsert({
      where: {
        id: `mock-${firstName.toLowerCase()}`,
      },
      create: {
        id: `mock-${firstName.toLowerCase()}`,
        firstName,
        lastName: lastNameParts.join(' '),
        clubId: mockClub.id,
      },
      update: {
        firstName,
        lastName: lastNameParts.join(' '),
        clubId: mockClub.id,
      },
    });
  }

  await ensureMatch({
    clubId: mockClub.id,
    homeTeam: 'Mockad testklubb A',
    awayTeam: 'Exempel BK',
    date: new Date('2026-09-12T10:00:00'),
    location: 'Testhallen',
    externalId: 'mock-2026-09-12-a',
    sourceTeamName: 'Mockad testklubb A',
  });
  await ensureMatch({
    clubId: mockClub.id,
    homeTeam: 'Mockad testklubb F',
    awayTeam: 'Demo BS',
    date: new Date('2026-09-13T13:00:00'),
    location: 'Testhallen',
    externalId: 'mock-2026-09-13-f',
    sourceTeamName: 'Mockad testklubb F',
  });

  const testPasswordHash = await bcrypt.hash('TestAdmin123!', 12);
  const testAdmin = await prisma.user.upsert({
    where: { email: 'testadmin@example.com' },
    create: {
      email: 'testadmin@example.com',
      passwordHash: testPasswordHash,
      role: 'CLUBADMIN',
      clubId: mockClub.id,
    },
    update: {
      passwordHash: testPasswordHash,
      role: 'CLUBADMIN',
      clubId: mockClub.id,
    },
  });

  await prisma.clubMembership.upsert({
    where: {
      userId_clubId: {
        userId: testAdmin.id,
        clubId: mockClub.id,
      },
    },
    create: {
      userId: testAdmin.id,
      clubId: mockClub.id,
      role: 'ADMIN',
    },
    update: {
      role: 'ADMIN',
    },
  });

  console.log(`Production seed ready: ${club.name} (${club.id}), TEST -> ${mockClub.name}, test admin -> testadmin@example.com`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
