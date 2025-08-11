import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

    // Create a test club
    const club = await prisma.club.create({
      data: {
        name: 'Testclub BK1',
        code: 'TEST',
      },
    });

    console.log(`Created club: ${club.name} (${club.code})`);

    // Create admin user
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

    // Create regular user
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

    // Add admin to club's admin relationship
    await prisma.club.update({
      where: { id: club.id },
      data: {
        admins: {
          connect: { id: adminUser.id }
        }
      }
    });

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
          lastName: 'Nilsson',
          number: 7,
          clubId: club.id,
        },
      }),
      prisma.player.create({
        data: {
          firstName: 'Lars',
          lastName: 'Johansson',
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
      prisma.player.create({
        data: {
          firstName: 'Johan',
          lastName: 'Karlsson',
          number: 15,
          clubId: club.id,
        },
      }),
      prisma.player.create({
        data: {
          firstName: 'Emma',
          lastName: 'Lindberg',
          number: 3,
          clubId: club.id,
        },
      }),
    ]);

    console.log(`Created ${players.length} players`);

    const matches = await Promise.all([
      prisma.match.create({
        data: {
          homeTeam: 'BK Allön',
          awayTeam: 'Femtionian',
          date: new Date('2025-08-15T19:00:00'),
          location: 'Bowlinghallen Kristianstad',
          clubId: club.id,
        },
      }),
      prisma.match.create({
        data: {
          homeTeam: 'Femtionian',
          awayTeam: 'BK Allön',
          date: new Date('2025-08-22T15:00:00'),
          location: 'Turbanhallen Hässleholm',
          clubId: club.id,
        },
      }),
      prisma.match.create({
        data: {
          homeTeam: 'Kulladals BS',
          awayTeam: 'BK Allön',
          date: new Date('2025-08-29T18:30:00'),
          location: 'Baltiska Bowlinghallen Malmö',
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
