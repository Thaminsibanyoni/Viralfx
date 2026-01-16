import { PrismaClient, UserRole, UserStatus, BrokerTier, BrokerType, BrokerStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

// Load environment variables
config();

const seedAllUsers = async () => {
  console.log('🌱 Starting comprehensive user seeding...');

  let prisma: PrismaClient | null = null;

  try {
    // Initialize Prisma connection
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    const results = {
      users: [],
      admin: null,
      broker: null,
      errors: []
    };

    // =====================================================
    // 1. CREATE REGULAR USER with R1000 balance
    // =====================================================
    console.log('\n📝 Creating regular User...');
    try {
      const existingUser = await prisma.user.findFirst({
        where: { email: 'user@user.com' }
      });

      if (existingUser) {
        console.log('⚠️  User already exists: user@user.com');
        console.log('   Updating balance to R1000...');

        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            balanceUsd: 1000.00,
            status: UserStatus.ACTIVE
          }
        });

        console.log('✅ User balance updated to R1000');
        results.users.push(updatedUser);
      } else {
        const hashedPassword = await bcrypt.hash('Password123', 12);

        const newUser = await prisma.user.create({
          data: {
            email: 'user@user.com',
            username: 'regularuser',
            password: hashedPassword,
            firstName: 'Regular',
            lastName: 'User',
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
            balanceUsd: 1000.00,
            balanceLocked: 0,
            emailVerified: true,
            country: 'ZA',
            twoFactorEnabled: false,
            isActive: true
          }
        });

        console.log('✅ Regular User created successfully!');
        console.log('   Email: user@user.com');
        console.log('   Password: Password123');
        console.log('   Balance: R1000.00');
        results.users.push(newUser);
      }
    } catch (error) {
      const errorMsg = `Failed to create/update user: ${error}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }

    // =====================================================
    // 2. CREATE SUPERADMIN
    // =====================================================
    console.log('\n📝 Creating SuperAdmin...');
    try {
      const existingAdmin = await prisma.adminUser.findFirst({
        where: { email: 'admin@admin.com' }
      });

      if (existingAdmin) {
        console.log('⚠️  SuperAdmin already exists: admin@admin.com');
        results.admin = existingAdmin;
      } else {
        const hashedPassword = await bcrypt.hash('Password123', 12);

        const superAdmin = await prisma.adminUser.create({
          data: {
            email: 'admin@admin.com',
            password: hashedPassword,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPER_ADMIN',
            isSuperAdmin: true,
            status: 'ACTIVE',
            twoFactorEnabled: false,
            lastLoginAt: null,
            department: 'EXECUTIVE'
          }
        });

        console.log('✅ SuperAdmin created successfully!');
        console.log('   Email: admin@admin.com');
        console.log('   Password: Password123');
        console.log('   Role: SUPER_ADMIN');
        results.admin = superAdmin;
      }
    } catch (error) {
      const errorMsg = `Failed to create SuperAdmin: ${error}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }

    // =====================================================
    // 3. CREATE BROKER
    // =====================================================
    console.log('\n📝 Creating Broker...');
    try {
      const existingBroker = await prisma.broker.findFirst({
        where: { contactEmail: 'broker@broker.com' }
      });

      if (existingBroker) {
        console.log('⚠️  Broker already exists: broker@broker.com');
        // Update existing broker with password
        const hashedPassword = await bcrypt.hash('Password123', 12);
        await prisma.broker.update({
          where: { id: existingBroker.id },
          data: { password: hashedPassword }
        });
        console.log('✅ Broker password updated!');
        results.broker = existingBroker;
      } else {
        const hashedPassword = await bcrypt.hash('Password123', 12);

        const broker = await prisma.broker.create({
          data: {
            companyName: 'Test Brokerage',
            registrationNumber: 'BRK2024001',
            fscaLicenseNumber: 'FSP-TEST-001',
            fscaLicenseExpiry: new Date('2025-12-31'),
            tier: BrokerTier.STARTER,
            type: BrokerType.INDEPENDENT_BROKER,
            status: BrokerStatus.VERIFIED,
            contactEmail: 'broker@broker.com',
            contactPhone: '+27 11 123 4567',
            password: hashedPassword,
            physicalAddress: '123 Test Street, Sandton, Johannesburg, 2196',
            postalAddress: 'PO Box 12345, Sandton, 2131',
            website: 'https://testbrokerage.co.za',
            isPubliclyListed: true,
            acceptNewClients: true,
            totalTraders: 0,
            totalVolume: 0,
            averageRating: 0
          }
        });

        console.log('✅ Broker created successfully!');
        console.log('   Company: Test Brokerage');
        console.log('   Email: broker@broker.com');
        console.log('   Password: Password123');
        console.log('   Registration: BRK2024001');
        console.log('   Status: APPROVED');
        results.broker = broker;
      }
    } catch (error) {
      const errorMsg = `Failed to create Broker: ${error}`;
      console.error(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }

    // =====================================================
    // SUMMARY
    // =====================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));

    if (results.users.length > 0) {
      console.log('\n✅ Users created/updated:');
      results.users.forEach(user => {
        console.log(`   - ${user.email} (Balance: R${user.balanceUsd})`);
      });
    }

    if (results.admin) {
      console.log('\n✅ SuperAdmin:');
      console.log(`   - ${results.admin.email}`);
    }

    if (results.broker) {
      console.log('\n✅ Broker:');
      console.log(`   - ${results.broker.companyName} (${results.broker.contactEmail})`);
    }

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }

    console.log('\n🔐 CREDENTIALS SUMMARY:');
    console.log('   1. User: user@user.com / Password123 (Balance: R1000)');
    console.log('   2. SuperAdmin: admin@admin.com / Password123');
    console.log('   3. Broker: broker@broker.com / Password123');
    console.log('\n🌐 Dashboard URLs:');
    console.log('   - User: http://localhost:5173/dashboard');
    console.log('   - SuperAdmin: http://localhost:5173/admin/login');
    console.log('   - Broker: http://localhost:5173/broker/login');
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Fatal error during seeding:', error);

    if (error instanceof Error) {
      if (error.message.includes('connection')) {
        console.error('   Database connection failed. Please ensure DATABASE_URL is correct.');
      }
    }

    process.exit(1);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
      console.log('\n🔌 Database connection closed');
    }
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\n🛑 User seeding interrupted');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 User seeding terminated');
  process.exit(0);
});

// Run the seeding
seedAllUsers()
  .then(() => {
    console.log('\n🎉 User seeding completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error during seeding:', error);
    process.exit(1);
  });
