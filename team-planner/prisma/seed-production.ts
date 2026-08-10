import { prisma } from '../src/app/lib/prisma';
import { getPlayDayKey, getPlayRoundInfo } from '../src/app/lib/rounds';

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
      swebowlSeason: 2026,
      swebowlTeamIds: '158483:923,160183:802,185282:802',
    },
    update: {
      code: 'BKALLON_UUID_ONLY',
      swebowlClub: 'BK Allön',
      swebowlSeason: 2026,
      swebowlTeamIds: '158483:923,160183:802,185282:802',
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

  const allonPlayers = [
    { firstName: 'Robert', lastName: 'Kempner' },
    { firstName: 'Jens', lastName: 'Lind' },
    { firstName: 'Josefin', lastName: 'Allsten' },
    { firstName: 'Mariette', lastName: 'Andersson' },
    { firstName: 'Leo', lastName: 'Andreasen' },
    { firstName: 'Maria', lastName: 'Caplander' },
    { firstName: 'Göran', lastName: 'Carlsson' },
    { firstName: 'Jack', lastName: 'Danell' },
    { firstName: 'Arvid', lastName: 'Ekvall' },
    { firstName: 'Adrian', lastName: 'Holgersson' },
    { firstName: 'Rasmus', lastName: 'Johansson' },
    { firstName: 'Pontus', lastName: 'Jonsson' },
    { firstName: 'Tim', lastName: 'Karlsson' },
    { firstName: 'Kenth', lastName: 'Lorentzen' },
    { firstName: 'Magnus', lastName: 'Lundahl' },
    { firstName: 'Axel', lastName: 'Nilsson' },
    { firstName: 'Hugo', lastName: 'Nilsson' },
    { firstName: 'Daniel', lastName: 'Pettersson' },
    { firstName: 'Wilda', lastName: 'Smarda' },
    { firstName: 'Torgny', lastName: 'Svensson' },
    { firstName: 'Philip', lastName: 'Thelandersson' },
    { firstName: 'Neo', lastName: 'Wehelie' },
    { firstName: 'Stefan', lastName: 'Nilsson' },
    { firstName: 'Håkan', lastName: 'Rossander' },
    { firstName: 'Henrik', lastName: 'Olsson' },
    { firstName: 'Maria', lastName: 'Allsten', nickname: 'Mia' },
    { firstName: 'Henrik', lastName: 'Andreasen' },
    { firstName: 'Tea', lastName: 'Andreasen' },
    { firstName: 'Minea', lastName: 'Caplander' },
    { firstName: 'Kim', lastName: 'Danell' },
    { firstName: 'Emil', lastName: 'Johansson' },
    { firstName: 'Gert', lastName: 'Johsson' },
    { firstName: 'Christer', lastName: 'Lind' },
    { firstName: 'Martin', lastName: 'Lindal' },
    { firstName: 'Robin', lastName: 'Lorentzen' },
    { firstName: 'Theo', lastName: 'Lundahl' },
    { firstName: 'Emil', lastName: 'Nilsson' },
    { firstName: 'Bengt', lastName: 'Olsson' },
    { firstName: 'Elna', lastName: 'Scherman' },
    { firstName: 'Therese', lastName: 'Svensson' },
    { firstName: 'Alexander', lastName: 'Vasilica' },
  ];
  const keepPlayerIds = [];

  for (const player of allonPlayers) {
    const existing = await prisma.player.findFirst({
      where: {
        clubId: club.id,
        firstName: player.firstName,
        lastName: player.lastName,
      },
    });

    const saved = existing
      ? await prisma.player.update({
          where: { id: existing.id },
          data: {
            firstName: player.firstName,
            lastName: player.lastName,
            nickname: player.nickname ?? null,
          },
        })
      : await prisma.player.create({
          data: {
            clubId: club.id,
            firstName: player.firstName,
            lastName: player.lastName,
            nickname: player.nickname ?? null,
          },
        });

    keepPlayerIds.push(saved.id);
  }

  await prisma.player.deleteMany({
    where: {
      clubId: club.id,
      id: { notIn: keepPlayerIds },
    },
  });

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

  console.log(`Production seed ready: ${club.name} (${club.id}), TEST -> ${mockClub.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
