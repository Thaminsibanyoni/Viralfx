import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

// Load environment variables
config();

const seedSuperAdmin = async () => {
  console.log('🌱 Starting SuperAdmin seeding...');

  let prisma: PrismaClient | null = null;

  try {
    // Initialize Prisma connection
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await prisma.adminUser.findFirst({
      where: { isSuperAdmin: true }
    });

    if (existingSuperAdmin) {
      console.log('⚠️  SuperAdmin already exists:', existingSuperAdmin.email);
      console.log('   Skipping seeding process.');
      return;
    }

    // Get SuperAdmin configuration from environment
    const email = process.env.SUPER_ADMIN_EMAIL || process.env.SUPERADMIN_EMAIL || 'admin@viralfx.com';
    const password = process.env.SUPER_ADMIN_PASSWORD || process.env.SUPERADMIN_PASSWORD || 'ChangeThisSecurePassword123!';
    const firstName = process.env.SUPER_ADMIN_FIRST_NAME || process.env.SUPERADMIN_FIRST_NAME || 'Super';
    const lastName = process.env.SUPER_ADMIN_LAST_NAME || process.env.SUPERADMIN_LAST_NAME || 'Admin';

    // Validate required environment variables
    if (!password || password === 'ChangeThisSecurePassword123!') {
      console.warn('⚠️  WARNING: Using default password. Please set SUPER_ADMIN_PASSWORD in your .env file');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create SuperAdmin user
    const superAdmin = await prisma.adminUser.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
        status: 'ACTIVE',
        twoFactorEnabled: false,
        lastLoginAt: null,
        department: 'EXECUTIVE'
      }
    });

    console.log('✅ SuperAdmin created successfully!');
    console.log('   Email:', email);
    console.log('   Name:', `${firstName} ${lastName}`);
    console.log('   Role:', 'SUPER_ADMIN');
    console.log('');
    console.log('🔐 IMPORTANT SECURITY NOTES:');
    console.log('   1. Change the default password immediately');
    console.log('   2. Enable Two-Factor Authentication (2FA)');
    console.log('   3. Configure IP whitelist for additional security');
    console.log('   4. Store credentials securely in a password manager');
    console.log('');
    console.log('🌐 Access the SuperAdmin dashboard at: http://localhost:5173/admin/login');

  } catch (error) {
    console.error('❌ Error during SuperAdmin seeding:', error);

    if (error instanceof Error) {
      if (error.message.includes('connection')) {
        console.error('   Database connection failed. Please ensure DATABASE_URL is correct.');
      } else if (error.message.includes('duplicate key') || error.message.includes('Unique constraint')) {
        console.error('   SuperAdmin with this email already exists.');
      }
    }

    process.exit(1);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
      console.log('🔌 Database connection closed');
    }
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 SuperAdmin seeding interrupted');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SuperAdmin seeding terminated');
  process.exit(0);
});

// Run the seeding
seedSuperAdmin()
  .then(() => {
    console.log('🎉 SuperAdmin seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error during seeding:', error);
    process.exit(1);
  });