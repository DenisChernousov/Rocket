import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@crash.game' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@crash.game',
      passwordHash,
      role: 'ADMIN',
      balance: 10000,
    },
  });
  console.log('Admin user created: admin / admin123');

  // Default site settings
  const defaults = [
    { key: 'house_edge', value: '3' },
    { key: 'min_bet', value: '1' },
    { key: 'max_bet', value: '10000' },
    { key: 'wait_time', value: '5' },
  ];

  for (const s of defaults) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log('Site settings seeded');

  console.log('Seed completed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
