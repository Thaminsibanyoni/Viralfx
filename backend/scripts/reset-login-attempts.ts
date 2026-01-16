import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function resetLoginAttempts() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    // Reset User login attempts
    await prisma.user.updateMany({
      where: { email: 'user@user.com' },
      data: { loginAttempts: 0, lockedUntil: null }
    });
    console.log('✅ User login attempts reset');

    // Reset Admin login attempts
    await prisma.adminUser.updateMany({
      where: { email: 'admin@admin.com' },
      data: { loginAttempts: 0, lockedUntil: null }
    });
    console.log('✅ Admin login attempts reset');

    // Reset Broker login attempts
    await prisma.broker.updateMany({
      where: { contactEmail: 'broker@broker.com' },
      data: { loginAttempts: 0, lockedUntil: null }
    });
    console.log('✅ Broker login attempts reset');

    console.log('\n🎉 All accounts unlocked successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetLoginAttempts();
