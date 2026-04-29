import { prisma } from '../src/app/lib/prisma';

async function main() {
  const club = await prisma.club.upsert({
    where: { code: 'TEST' },
    create: {
      name: 'BK Allön',
      code: 'TEST',
      swebowlClub: 'BK Allön',
      swebowlSeason: 2025,
      swebowlTeamIds: '158483,160183,185282',
    },
    update: {
      name: 'BK Allön',
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

  console.log(`Production seed ready: ${club.name} (${club.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
