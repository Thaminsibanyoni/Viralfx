import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../entities/admin-user.entity';
import { AdminSession } from '../entities/admin-session.entity';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private config: ConfigService,
    @InjectRepository(AdminUser)
    private adminRepository: Repository<AdminUser>,
    @InjectRepository(AdminSession)
    private sessionRepository: Repository<AdminSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Admin access token required');
    }

    try {
      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_ADMIN_SECRET'),
      });

      // Find admin session
      const session = await this.sessionRepository.findOne({
        where: { token, isActive: true, expiresAt: { $gte: new Date() } },
        relations: ['admin'],
      });

      if (!session || !session.admin) {
        throw new UnauthorizedException('Invalid or expired admin session');
      }

      // Check admin status
      if (session.admin.status !== 'ACTIVE') {
        throw new ForbiddenException('Admin account is not active');
      }

      // Check IP whitelist if configured
      if (session.admin.ipWhitelist.length > 0) {
        const clientIp = request.ip || request.connection.remoteAddress;
        if (!session.admin.ipWhitelist.includes(clientIp)) {
          throw new ForbiddenException('IP address not whitelisted');
        }
      }

      // Update session activity
      await this.sessionRepository.update(session.id, {
        lastActivityAt: new Date(),
      });

      // Check required permissions
      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
        PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (requiredPermissions && requiredPermissions.length > 0) {
        await this.checkPermissions(session.admin, requiredPermissions);
      }

      // Attach admin to request
      request.admin = session.admin;
      request.session = session;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid admin token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async checkPermissions(admin: AdminUser, requiredPermissions: string[]): Promise<void> {
    // SuperAdmin has all permissions
    if (admin.isSuperAdmin) {
      return;
    }

    // Check admin's explicit permissions
    const adminPermissions = admin.permissions || [];
    const permissionNames = adminPermissions.map((p) => `${p.resource}:${p.action}`);

    // Check if admin has all required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      permissionNames.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredPermissions.join(', ')}`);
    }
  }
}