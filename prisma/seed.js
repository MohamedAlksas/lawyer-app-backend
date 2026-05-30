import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@lawyerapp.com';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('Admin user already exists, skipping seed');
    return;
  }

  const password = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      fullName: 'Admin',
      email: adminEmail,
      password,
      role: 'ADMIN',
      phone: '01000000000',
    },
  });
  console.log('Admin user created: admin@lawyerapp.com / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
