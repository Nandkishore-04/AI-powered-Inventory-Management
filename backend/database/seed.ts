import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

const prisma = new PrismaClient();
dotenv.config();

function getRequiredSeedEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required seed environment variable: ${name}`);
  }
  return value.trim();
}

async function main() {
  console.log('Starting seed...');

  const adminEmail = getRequiredSeedEnv('SEED_ADMIN_EMAIL');
  const adminPasswordRaw = getRequiredSeedEnv('SEED_ADMIN_PASSWORD');
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || 'Admin';

  const managerEmail = getRequiredSeedEnv('SEED_MANAGER_EMAIL');
  const managerPasswordRaw = getRequiredSeedEnv('SEED_MANAGER_PASSWORD');
  const managerName = process.env.SEED_MANAGER_NAME?.trim() || 'Manager';

  // Create users
  const adminPassword = await bcrypt.hash(adminPasswordRaw, 10);
  const managerPassword = await bcrypt.hash(managerPasswordRaw, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPassword,
      name: adminName,
      role: 'ADMIN',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {},
    create: {
      email: managerEmail,
      passwordHash: managerPassword,
      name: managerName,
      role: 'MANAGER',
    },
  });

  console.log('Created users:', { admin: admin.email, manager: manager.email });

  console.log('Seed skipped suppliers/products. They are now created only from invoice ingestion.');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
