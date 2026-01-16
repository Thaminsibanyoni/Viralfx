import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function updatePasswords() {
  try {
    await prisma.$connect();
    console.log('Connected to database\n');

    const hashedPassword = await bcrypt.hash('Password123', 12);

    // Update User password
    await prisma.user.updateMany({
      where: { email: 'user@user.com' },
      data: { password: hashedPassword }
    });
    console.log('✅ User password updated: user@user.com / Password123');

    // Update Admin password
    await prisma.adminUser.updateMany({
      where: { email: 'admin@admin.com' },
      data: { password: hashedPassword }
    });
    console.log('✅ Admin password updated: admin@admin.com / Password123');

    // Update Broker password
    await prisma.broker.updateMany({
      where: { contactEmail: 'broker@broker.com' },
      data: { password: hashedPassword }
    });
    console.log('✅ Broker password updated: broker@broker.com / Password123');

    console.log('\n🎉 All passwords updated successfully!');
    console.log('\n📝 LOGIN CREDENTIALS:');
    console.log('   User:      user@user.com / Password123');
    console.log('   Admin:     admin@admin.com / Password123');
    console.log('   Broker:    broker@broker.com / Password123');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePasswords();
