import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from "../../../../prisma/prisma.service";

// Guards to test
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../roles.guard';
import { PermissionsGuard } from '../permissions.guard';
import { ThrottleGuard } from '../throttle.guard';

describe('Authentication & Authorization Guards', () => {
  let reflector: Reflector;
  let jwtService: JwtService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
  providers: [
  Reflector,
  {
  provide: JwtService,
  useValue: {
  verify: jest.fn()
  }
  },
  {
  provide: PrismaService,
  useValue: {
  user: {
  findUnique: jest.fn()
  }
  }
  },
  {
  provide: ConfigService,
  useValue: {
  get: jest.fn()
  }
  }
  ]
  }).compile();

  reflector = module.get<Reflector>(Reflector);
  jwtService = module.get<JwtService>(JwtService);
  prismaService = module.get<PrismaService>(PrismaService);
  configService = module.get<ConfigService>(ConfigService);
  });

  describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
  guard = new JwtAuthGuard(reflector);
  });

  it('should allow access to public routes', async () => {
  const context = createMockExecutionContext();
  reflector.getAllAndOverride = jest.fn().mockReturnValue(true);
  const result = await guard.canActivate(context);
  expect(result).toBe(true);
  });

  it('should throw UnauthorizedException for missing token', async () => {
  const context = createMockExecutionContext();
  reflector.getAllAndOverride = jest.fn().mockReturnValue(false);
  await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
  });

  describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
  guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', async () => {
  const context = createMockExecutionContext();
  reflector.getAllAndOverride = jest.fn().mockReturnValue([]);
  const result = await guard.canActivate(context);
  expect(result).toBe(true);
  });

  it('should allow access when user has required roles', async () => {
  const context = createMockExecutionContext({
  user: { roles: ['admin', 'user'] }
  });
  reflector.getAllAndOverride = jest.fn().mockReturnValue(['admin']);
  const result = await guard.canActivate(context);
  expect(result).toBe(true);
  });

  it('should deny access when user lacks required roles', async () => {
  const context = createMockExecutionContext({
  user: { roles: ['user'] }
  });
  reflector.getAllAndOverride = jest.fn().mockReturnValue(['admin']);
  const result = await guard.canActivate(context);
  expect(result).toBe(false);
  });
  });

  describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  beforeEach(() => {
  guard = new PermissionsGuard(reflector);
  });

  it('should allow access when no permissions are required', async () => {
  const context = createMockExecutionContext({
  user: { permissions: [] }
  });
  reflector.getAllAndOverride = jest.fn().mockReturnValue([]);
  const result = await guard.canActivate(context);
  expect(result).toBe(true);
  });

  it('should allow access when user has required permissions', async () => {
  const context = createMockExecutionContext({
  user: { permissions: ['users:read', 'users:write'] }
  });
  reflector.getAllAndOverride = jest.fn().mockReturnValue(['users:read']);
  const result = await guard.canActivate(context);
  expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user lacks required permissions', async () => {
  const context = createMockExecutionContext({
  user: { permissions: ['users:read'] }
  });
  reflector.getAllAndOverride = jest.fn().mockReturnValue(['users:write']);
  await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is not authenticated', async () => {
  const context = createMockExecutionContext();
  reflector.getAllAndOverride = jest.fn().mockReturnValue(['users:read']);
  await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
  });

  describe('ThrottleGuard', () => {
  let guard: ThrottleGuard;

  beforeEach(() => {
  guard = new ThrottleGuard(reflector);
  });

  it('should allow access within rate limits', async () => {
  const context = createMockExecutionContext();
  reflector.getAllAndOverride = jest.fn().mockReturnValue(100);
  const result = await guard.canActivate(context);
  expect(result).toBe(true);
  });

  it('should add rate limit headers to response', async () => {
  const mockResponse = {
  setHeader: jest.fn()
  };
  const context = createMockExecutionContext({}, mockResponse);
  reflector.getAllAndOverride = jest.fn().mockReturnValue(100);
  await guard.canActivate(context);
  expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
  expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
  expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });
  });

  // Helper function to create mock execution context
  function createMockExecutionContext(request: any = {}, response: any = {}): ExecutionContext {
  const mockRequest = {
  headers: {},
  user: null,
  ...request
  };
  const mockResponse = {
  setHeader: jest.fn(),
  ...response
  };

  return {
  switchToHttp: () => ({
  getRequest: () => mockRequest,
  getResponse: () => mockResponse
  }),
  getHandler: () => ({}),
  getClass: () => ({})
  } as ExecutionContext;
  }
});