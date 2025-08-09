import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

async function seedDatabase() {
  try {
    console.log('Seeding database...');

    console.log('Cleaning existing data...');
    await prisma.assignment.deleteMany();
    await prisma.joinRequest.deleteMany();
    await prisma.match.deleteMany();
    await prisma.player.deleteMany();
    await prisma.user.deleteMany();
    await prisma.club.deleteMany();
    console.log('Database cleaned');

    const club = await prisma.club.create({
      data: {
        name: 'Testclub FC',
        code: 'TEST',
      },
    });

    console.log(`Created club: ${club.name} (${club.code})`);

    const players = await Promise.all([
      prisma.player.create({
        data: {
          firstName: 'Erik',
          lastName: 'Andersson',
          number: 10,
          clubId: club.id,
        },
      }),
      prisma.player.create({
        data: {
          firstName: 'Anna',
          lastName: 'Karlsson',
          number: 7,
          clubId: club.id,
        },
      }),
      prisma.player.create({
        data: {
          firstName: 'Johan',
          lastName: 'Lindberg',
          number: 21,
          clubId: club.id,
        },
      }),
      prisma.player.create({
        data: {
          firstName: 'Maria',
          lastName: 'Svensson',
          clubId: club.id,
        },
      }),
    ]);

    console.log(`Created ${players.length} players`);

    const matches = await Promise.all([
      prisma.match.create({
        data: {
          homeTeam: 'Testclub FC',
          awayTeam: 'Rival FC',
          date: new Date('2025-08-15T19:00:00'),
          location: 'Hemmaplan',
          clubId: club.id,
        },
      }),
      prisma.match.create({
        data: {
          homeTeam: 'Champions United',
          awayTeam: 'Testclub FC',
          date: new Date('2025-08-22T15:00:00'),
          location: 'Bortaplan',
          clubId: club.id,
        },
      }),
    ]);

    console.log(`Created ${matches.length} matches`);

    const assignments = await Promise.all([
      prisma.assignment.create({
        data: {
          matchId: matches[0].id,
          playerId: players[0].id,
          position: 'Forward',
          status: 'CONFIRMED',
        },
      }),
      prisma.assignment.create({
        data: {
          matchId: matches[0].id,
          playerId: players[1].id,
          position: 'Midfielder',
          status: 'PENDING',
        },
      }),
    ]);

    console.log(`Created ${assignments.length} assignments`);

    const joinRequest = await prisma.joinRequest.create({
      data: {
        email: 'newplayer@example.com',
        name: 'Nya Spelaren',
        clubId: club.id,
        status: 'PENDING',
      },
    });

    console.log(`Created join request for: ${joinRequest.name}`);

    console.log('🎉 Database seeded successfully!');
    console.log(`\nTest data created:`);
    console.log(`- Club: ${club.name} (code: ${club.code})`);
    console.log(`- Players: ${players.length}`);
    console.log(`- Matches: ${matches.length}`);
    console.log(`- Assignments: ${assignments.length}`);
    console.log(`- Join requests: 1`);

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase()
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;
