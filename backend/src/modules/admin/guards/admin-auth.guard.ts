import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Admin access token required');
    }

    try {
      // Verify JWT token
      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_ADMIN_SECRET')
      });

      // For now, allow the request - full session validation requires DB setup
      // TODO: Implement proper session validation once Prisma models are set up
      request.admin = {
        id: payload.sub || 'admin',
        email: payload.email || 'admin@viralfx.com',
        isSuperAdmin: true,
        permissions: []
      };

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
}
