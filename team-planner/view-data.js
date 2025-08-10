const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function viewData() {
  try {
    console.log('=== KLUBBAR ===');
    const clubs = await prisma.club.findMany();
    console.log(clubs);

    console.log('\n=== SPELARE ===');
    const players = await prisma.player.findMany();
    console.log(players);

    console.log('\n=== MATCHER ===');
    const matches = await prisma.match.findMany();
    console.log(matches);

    console.log('\n=== TILLDELNINGAR ===');
    const assignments = await prisma.assignment.findMany({
      include: {
        player: true,
        match: true
      }
    });
    console.log(assignments);

    console.log('\n=== ANSÖKNINGAR ===');
    const joinRequests = await prisma.joinRequest.findMany();
    console.log(joinRequests);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

viewData();
