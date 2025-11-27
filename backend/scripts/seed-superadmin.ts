import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { AdminUser, AdminRole, AdminStatus } from '../src/modules/admin/entities/admin-user.entity';

// Load environment variables
config();

const seedSuperAdmin = async () => {
  console.log('🌱 Starting SuperAdmin seeding...');

  let dataSource: DataSource | null = null;

  try {
    // Initialize TypeORM connection
    dataSource = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/viralfx',
      entities: [AdminUser],
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    console.log('✅ Database connected successfully');

    const adminUserRepository = dataSource.getRepository(AdminUser);

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await adminUserRepository.findOne({
      where: { isSuperAdmin: true }
    });

    if (existingSuperAdmin) {
      console.log('⚠️  SuperAdmin already exists:', existingSuperAdmin.email);
      console.log('   Skipping seeding process.');
      return;
    }

    // Get SuperAdmin configuration from environment
    const email = process.env.SUPERADMIN_EMAIL || 'admin@viralfx.com';
    const password = process.env.SUPERADMIN_PASSWORD || 'ChangeThisSecurePassword123!';
    const firstName = process.env.SUPERADMIN_FIRST_NAME || 'Super';
    const lastName = process.env.SUPERADMIN_LAST_NAME || 'Admin';

    // Validate required environment variables
    if (!password || password === 'ChangeThisSecurePassword123!') {
      console.warn('⚠️  WARNING: Using default password. Please set SUPERADMIN_PASSWORD in your .env file');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create SuperAdmin user
    const superAdmin = adminUserRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: AdminRole.SUPER_ADMIN,
      isSuperAdmin: true,
      status: AdminStatus.ACTIVE,
      twoFactorEnabled: false,
      ipWhitelist: [],
      jurisdictionClearance: ['ZA', 'GLOBAL'],
      lastLoginAt: null,
      emailVerifiedAt: new Date(),
    });

    await adminUserRepository.save(superAdmin);

    console.log('✅ SuperAdmin created successfully!');
    console.log('   Email:', email);
    console.log('   Name:', `${firstName} ${lastName}`);
    console.log('   Role:', AdminRole.SUPER_ADMIN);
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
      } else if (error.message.includes('duplicate key')) {
        console.error('   SuperAdmin with this email already exists.');
      }
    }

    process.exit(1);
  } finally {
    if (dataSource) {
      await dataSource.destroy();
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