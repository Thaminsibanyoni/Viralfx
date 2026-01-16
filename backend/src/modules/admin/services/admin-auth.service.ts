import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';

import { AdminLoginDto, CreateAdminDto, UpdateAdminDto } from '../dto/create-admin.dto';
import { AdminRole, AdminStatus } from '../enums/admin.enum';
import { AuditAction, AuditSeverity } from '../../audit/enums/audit.enum';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditHelper } from '../helpers/audit-helper';

export interface AdminTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private config: ConfigService,
        private auditHelper: AuditHelper) {}

  async createAdmin(createAdminDto: CreateAdminDto): Promise<AdminUser> {
    // Check if admin already exists
    const existingAdmin = await this.prisma.adminUser.findFirst({
      where: { email: createAdminDto.email }
    });

    if (existingAdmin) {
      throw new ConflictException('Admin with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createAdminDto.password, this.SALT_ROUNDS);

    // Create admin
    const admin = this.prisma.adminUser.create({
      ...createAdminDto,
      password: hashedPassword,
      isSuperAdmin: createAdminDto.isSuperAdmin || createAdminDto.role === AdminRole.SUPER_ADMIN
    });

    const savedAdmin = await this.prisma.adminUser.upsert(admin);

    // Handle permissions
    if (createAdminDto.permissionIds && createAdminDto.permissionIds.length > 0) {
      const permissions = await this.prisma.findByIds(createAdminDto.permissionIds);
      savedAdmin.permissions = permissions;
      await this.prisma.adminUser.upsert(savedAdmin);
    }

    // Log the action
    await this.prisma.auditLog.upsert({
      adminId: 'SYSTEM', // Would be the creating admin's ID
      action: AuditAction.ADMIN_CREATE,
      severity: AuditSeverity.HIGH,
      targetType: 'AdminUser',
      targetId: savedAdmin.id,
      metadata: {
        createdAdmin: {
          email: savedAdmin.email,
          role: savedAdmin.role,
          department: savedAdmin.department
        }
      },
      description: `Created new admin: ${savedAdmin.email}`
    });

    this.logger.log(`New admin created: ${savedAdmin.email}`);

    return savedAdmin;
  }

  async login(loginDto: AdminLoginDto): Promise<{ admin: AdminUser; tokens: AdminTokens }> {
    // Find admin
    const admin = await this.prisma.adminUser.findFirst({
      where: { email: loginDto.email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account status
    if (admin.status !== AdminStatus.ACTIVE) {
      this.logger.warn(`Login attempt for inactive admin account: ${loginDto.email}`);
      throw new UnauthorizedException('Admin account is not active');
    }

    // Check login attempts
    const loginAttempts = await this.getLoginAttempts(admin.id);
    if (loginAttempts >= this.MAX_ATTEMPTS) {
      const lastAttempt = await this.getLastLoginAttempt(admin.id);
      if (lastAttempt && Date.now() - lastAttempt.getTime() < this.LOCK_TIME) {
        throw new UnauthorizedException('Account temporarily locked. Please try again later.');
      }
    }

    // Verify password
    const passwordValid = await bcrypt.compare(loginDto.password, admin.password);
    if (!passwordValid) {
      await this.recordLoginAttempt(admin.id, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check 2FA if enabled
    if (admin.twoFactorEnabled) {
      if (!loginDto.twoFactorCode) {
        throw new UnauthorizedException('2FA code required');
      }

      const verified = speakeasy.totp.verify({
        secret: admin.twoFactorSecret!,
        encoding: 'base32',
        token: loginDto.twoFactorCode,
        window: 2
      });

      if (!verified) {
        await this.recordLoginAttempt(admin.id, false);
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Clear login attempts on successful login
    await this.clearLoginAttempts(admin.id);

    // Update admin record
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: loginDto.ipAddress
      }
    });

    // Generate tokens
    const tokens = await this.generateTokens(admin.id, admin.email);

    // Create session
    // TEMPORARILY DISABLED: await this.createSession(admin.id, tokens, loginDto);

    // Log successful login
    await this.auditHelper.logAdminAction(
      admin.id,
      AuditAction.ADMIN_LOGIN,
      AuditSeverity.LOW,
      'AdminUser',
      admin.id,
      loginDto.ipAddress,
      loginDto.userAgent,
      `Admin login: ${admin.email}`
    );

    this.logger.log(`Admin logged in successfully: ${admin.email}`);

    return {
      admin: this.sanitizeAdmin(admin),
      tokens
    };
  }

  async logout(adminId: string, sessionId: string): Promise<void> {
    // Deactivate session
    await this.prisma.sessionrepository.update(
      { id: sessionId, adminId },
      { isActive: false });

    // Log logout
    await this.prisma.auditLog.upsert({
      adminId,
      action: AuditAction.LOGOUT,
      severity: AuditSeverity.LOW,
      targetType: 'AdminUser',
      targetId: adminId,
      description: 'Admin logout'
    });

    this.logger.log(`Admin logged out: ${adminId}`);
  }

  async refreshToken(refreshToken: string): Promise<AdminTokens> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_ADMIN_REFRESH_SECRET')
      });

      // Find session
      const session = await this.prisma.sessionrepository.findFirst({
        where: { refreshToken, isActive: true },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      if (session.admin.status !== AdminStatus.ACTIVE) {
        throw new UnauthorizedException('Admin account is not active');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(session.admin.id, session.admin.email);

      // Update session
      await this.prisma.sessionrepository.update(session.id, {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async updateAdmin(adminId: string, updateDto: UpdateAdminDto): Promise<AdminUser> {
    const admin = await this.prisma.adminUser.findFirst({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Update admin fields
    Object.assign(admin, updateDto);

    if (updateDto.permissionIds) {
      const permissions = await this.prisma.findByIds(updateDto.permissionIds);
      admin.permissions = permissions;
    }

    const updatedAdmin = await this.prisma.adminUser.upsert(admin);

    // Log the update
    await this.prisma.auditLog.upsert({
      adminId, // Would be the updating admin's ID
      action: AuditAction.ADMIN_UPDATE,
      severity: AuditSeverity.MEDIUM,
      targetType: 'AdminUser',
      targetId: adminId,
      metadata: {
        changes: updateDto
      },
      description: `Updated admin: ${admin.email}`
    });

    return this.sanitizeAdmin(updatedAdmin);
  }

  async getAdminById(adminId: string): Promise<AdminUser> {
    const admin = await this.prisma.adminUser.findFirst({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return this.sanitizeAdmin(admin);
  }

  async getAllAdmins(page: number = 1, limit: number = 50): Promise<{ admins: AdminUser[]; total: number }> {
    const [admins, total] = await this.prisma.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' }
    });

    return {
      admins: admins.map(admin => this.sanitizeAdmin(admin)),
      total
    };
  }

  private sanitizeAdmin(admin: AdminUser): AdminUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, twoFactorSecret, ...sanitized } = admin;
    return sanitized as AdminUser;
  }

  private async generateTokens(adminId: string, email: string): Promise<AdminTokens> {
    const payload = {
      sub: adminId,
      email,
      type: 'admin'
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_ADMIN_SECRET'),
        expiresIn: this.config.get('JWT_ADMIN_EXPIRES_IN', '15m')
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_ADMIN_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_ADMIN_REFRESH_EXPIRES_IN', '7d')
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get('JWT_ADMIN_EXPIRES_IN', '15m')
    };
  }

  private async createSession(
    adminId: string,
    tokens: AdminTokens,
    loginDto: AdminLoginDto): Promise<void> {
    const session = this.prisma.sessionrepository.create({
      adminId,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ipAddress: loginDto.ipAddress,
      userAgent: loginDto.userAgent,
      deviceFingerprint: loginDto.deviceFingerprint,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await this.prisma.sessionrepository.upsert(session);
  }

  private async getLoginAttempts(adminId: string): Promise<number> {
    const recentAttempts = await this.prisma.auditLog.findMany({
      where: {
        userId: adminId,
        action: AuditAction.LOGIN,
        severity: AuditSeverity.MEDIUM, // Failed logins are marked as medium severity
        createdAt: {
          gte: new Date(Date.now() - this.LOCK_TIME)
        }
      },
      select: { id: true }
    });

    return recentAttempts.length;
  }

  private async getLastLoginAttempt(adminId: string): Promise<Date | null> {
    const lastAttempt = await this.prisma.auditLog.findFirst({
      where: {
        userId: adminId,
        action: AuditAction.LOGIN,
        severity: AuditSeverity.MEDIUM
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    return lastAttempt?.createdAt || null;
  }

  private async recordLoginAttempt(adminId: string, success: boolean): Promise<void> {
    await this.auditHelper.logAdminAction(
      adminId,
      AuditAction.LOGIN,
      success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      'AdminUser',
      adminId,
      undefined,
      undefined,
      success ? 'Successful login attempt' : 'Failed login attempt'
    );
  }

  private async clearLoginAttempts(adminId: string): Promise<void> {
    // Clear recent failed login attempts by creating a successful login audit
    await this.auditHelper.logAdminAction(
      adminId,
      AuditAction.ADMIN_UPDATE,
      AuditSeverity.LOW,
      'AdminUser',
      adminId,
      undefined,
      undefined,
      'Login attempts cleared after successful authentication'
    );
  }
}
