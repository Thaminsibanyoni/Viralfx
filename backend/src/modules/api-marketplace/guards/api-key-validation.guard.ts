import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class ApiKeyValidationGuard implements CanActivate {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    try {
      const keyRecord = await this.prismaService.apiKey.findFirst({
        where: {
          key: apiKey,
          isActive: true,
        },
        include: {
          user: true,
        },
      });

      if (!keyRecord) {
        throw new UnauthorizedException('Invalid API key');
      }

      // Attach user and key to request
      request.user = keyRecord.user;
      request.apiKey = keyRecord;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('API key validation failed');
    }
  }
}