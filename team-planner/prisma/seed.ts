import bcrypt from 'bcryptjs';
import { prisma } from '../src/app/lib/prisma';
import { getPlayDayKey, getPlayRoundInfo } from '../src/app/lib/rounds';

async function createSeedMatch(data: {
  homeTeam: string;
  awayTeam: string;
  date: Date;
  location: string;
  clubId: string;
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

  return prisma.match.create({
    data: {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      date: data.date,
      location: data.location,
      clubId: data.clubId,
      source: 'SWEBOWL',
      externalId: data.externalId,
      sourceTeamName: data.sourceTeamName,
      playDayId: playDay.id,
    },
  });
}

async function seedDatabase() {
  try {
    console.log('Seeding database...');

    console.log('Cleaning existing data...');
    await prisma.lineupPlayer.deleteMany();
    await prisma.lineup.deleteMany();
    await prisma.team.deleteMany();
    await prisma.clubMembership.deleteMany();
    await prisma.dayAbsence.deleteMany();
    await prisma.absence.deleteMany();
    await prisma.assignment.deleteMany();
    await prisma.match.deleteMany();
    await prisma.playDay.deleteMany();
    await prisma.playRound.deleteMany();
    await prisma.joinRequest.deleteMany();
    await prisma.player.deleteMany();
    await prisma.user.deleteMany();
    await prisma.club.deleteMany();
    console.log('Database cleaned');

    const club = await prisma.club.create({
      data: {
        name: 'BK Allön',
        code: 'TEST',
        swebowlClub: 'BK Allön',
        swebowlSeason: 2025,
        swebowlTeamIds: '158483,160183,185282',
      },
    });

    console.log(`Created club: ${club.name} (${club.code})`);

    const hashedPassword = await bcrypt.hash('admin123', 12);
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        passwordHash: hashedPassword,
        role: 'SUPERADMIN',
        clubId: club.id,
      },
    });

    console.log(`Created admin user: ${adminUser.email}`);

    const regularHashedPassword = await bcrypt.hash('user123', 12);
    const regularUser = await prisma.user.create({
      data: {
        email: 'user@test.com',
        passwordHash: regularHashedPassword,
        role: 'SELECTOR',
        clubId: club.id,
      },
    });

    console.log(`Created regular user: ${regularUser.email}`);

    await prisma.club.update({
      where: { id: club.id },
      data: {
        admins: {
          connect: { id: adminUser.id },
        },
      },
    });

    await prisma.clubMembership.create({
      data: {
        userId: adminUser.id,
        clubId: club.id,
        role: 'ADMIN',
      },
    });

    await prisma.clubMembership.create({
      data: {
        userId: regularUser.id,
        clubId: club.id,
        role: 'UK',
      },
    });

    const players = await Promise.all([
      prisma.player.create({
        data: { firstName: 'Erik', lastName: 'Andersson', number: 10, clubId: club.id },
      }),
      prisma.player.create({
        data: { firstName: 'Anna', lastName: 'Nilsson', number: 7, clubId: club.id },
      }),
      prisma.player.create({
        data: { firstName: 'Lars', lastName: 'Johansson', number: 21, clubId: club.id },
      }),
      prisma.player.create({
        data: { firstName: 'Maria', lastName: 'Svensson', clubId: club.id },
      }),
      prisma.player.create({
        data: { firstName: 'Johan', lastName: 'Karlsson', number: 15, clubId: club.id },
      }),
      prisma.player.create({
        data: { firstName: 'Emma', lastName: 'Lindberg', number: 3, clubId: club.id },
      }),
    ]);

    console.log(`Created ${players.length} players`);

    const teams = await Promise.all([
      prisma.team.create({
        data: { clubId: club.id, name: 'A-lag', swebowlTeamId: '158483', sortOrder: 0 },
      }),
      prisma.team.create({
        data: { clubId: club.id, name: 'F-lag', swebowlTeamId: '160183', sortOrder: 1 },
      }),
      prisma.team.create({
        data: { clubId: club.id, name: 'B-lag', swebowlTeamId: '185282', sortOrder: 2 },
      }),
    ]);

    console.log(`Created ${teams.length} teams`);

    const matches = await Promise.all([
      createSeedMatch({
        homeTeam: 'BK Allon F1',
        awayTeam: 'Femtionian',
        date: new Date('2026-08-15T10:00:00'),
        location: 'Bowlinghallen Kristianstad',
        clubId: club.id,
        externalId: 'seed-2026-08-15-f1',
        sourceTeamName: 'BK Allon F1',
      }),
      createSeedMatch({
        homeTeam: 'BK Allon F2',
        awayTeam: 'Team Ystad',
        date: new Date('2026-08-15T14:00:00'),
        location: 'Bowlinghallen Kristianstad',
        clubId: club.id,
        externalId: 'seed-2026-08-15-f2',
        sourceTeamName: 'BK Allon F2',
      }),
      createSeedMatch({
        homeTeam: 'Femtionian',
        awayTeam: 'BK Allon F1',
        date: new Date('2026-08-22T15:00:00'),
        location: 'Turbanhallen Hassleholm',
        clubId: club.id,
        externalId: 'seed-2026-08-22-f1',
        sourceTeamName: 'BK Allon F1',
      }),
      createSeedMatch({
        homeTeam: 'BK Allon F2',
        awayTeam: 'Kulladals BS',
        date: new Date('2026-08-23T10:00:00'),
        location: 'Bowlinghallen Kristianstad',
        clubId: club.id,
        externalId: 'seed-2026-08-23-f2',
        sourceTeamName: 'BK Allon F2',
      }),
      createSeedMatch({
        homeTeam: 'BK Allon F3',
        awayTeam: 'BK Joker',
        date: new Date('2026-08-23T13:30:00'),
        location: 'Bowlinghallen Kristianstad',
        clubId: club.id,
        externalId: 'seed-2026-08-23-f3',
        sourceTeamName: 'BK Allon F3',
      }),
      createSeedMatch({
        homeTeam: 'BK Allon F1',
        awayTeam: 'Team Malmo',
        date: new Date('2026-09-05T11:00:00'),
        location: 'Bowlinghallen Kristianstad',
        clubId: club.id,
        externalId: 'seed-2026-09-05-f1',
        sourceTeamName: 'BK Allon F1',
      }),
    ]);

    console.log(`Created ${matches.length} matches`);

    const assignments = await Promise.all([
      prisma.assignment.create({
        data: {
          matchId: matches[0].id,
          playerId: players[0].id,
          position: 'Spelare 1',
          status: 'CONFIRMED',
        },
      }),
      prisma.assignment.create({
        data: {
          matchId: matches[0].id,
          playerId: players[1].id,
          position: 'Spelare 2',
          status: 'PENDING',
        },
      }),
      prisma.assignment.create({
        data: {
          matchId: matches[0].id,
          playerId: players[2].id,
          position: 'Spelare 3',
          status: 'CONFIRMED',
        },
      }),
      prisma.assignment.create({
        data: {
          matchId: matches[1].id,
          playerId: players[0].id,
          position: 'Spelare 1',
          status: 'PENDING',
        },
      }),
      prisma.assignment.create({
        data: {
          matchId: matches[1].id,
          playerId: players[3].id,
          position: 'Spelare 2',
          status: 'CONFIRMED',
        },
      }),
    ]);

    console.log(`Created ${assignments.length} assignments`);

    const absences = await Promise.all([
      prisma.absence.create({
        data: {
          matchId: matches[1].id,
          playerId: players[2].id,
        },
      }),
      prisma.absence.create({
        data: {
          matchId: matches[2].id,
          playerId: players[4].id,
        },
      }),
    ]);

    console.log(`Created ${absences.length} absences`);

    const joinRequest = await prisma.joinRequest.create({
      data: {
        email: 'nybowlare@example.com',
        name: 'Peter Bowlsson',
        clubId: club.id,
        status: 'PENDING',
      },
    });

    console.log(`Created join request for: ${joinRequest.name}`);

    console.log('Database seeded successfully!');
    console.log('\nTest data created:');
    console.log(`- Club: ${club.name} (code: ${club.code})`);
    console.log(`- Players: ${players.length}`);
    console.log(`- Teams: ${teams.length}`);
    console.log(`- Matches: ${matches.length}`);
    console.log(`- Assignments: ${assignments.length}`);
    console.log(`- Absences: ${absences.length}`);
    console.log('- Join requests: 1');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

export default seedDatabase;
