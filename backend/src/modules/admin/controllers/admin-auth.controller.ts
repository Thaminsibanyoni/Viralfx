import { 
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus, Req } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { Permissions, ROLES } from '../decorators/permissions.decorator';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminRbacService } from '../services/admin-rbac.service';
import { AdminLoginDto, CreateAdminDto, UpdateAdminDto } from '../dto/create-admin.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private adminAuthService: AdminAuthService,
    private rbacService: AdminRbacService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: AdminLoginDto) {
    return await this.adminAuthService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return { tokens: await this.adminAuthService.refreshToken(refreshToken) };
  }

  @UseGuards(AdminAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: { session: { id: string }; admin: AdminUser }) {
    await this.adminAuthService.logout(req.admin.id, req.session.id);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(AdminAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: { admin: AdminUser }) {
    return req.admin;
  }

  @UseGuards(AdminAuthGuard)
  @Put('profile')
  async updateProfile(
    @Req() req: { admin: AdminUser },
    @Body() updateDto: UpdateAdminDto) {
    return await this.adminAuthService.updateAdmin(req.admin.id, updateDto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('permissions')
  async getMyPermissions(@Req() req: { admin: AdminUser }) {
    const rolePermissions = this.rbacService.getRolePermissions(req.admin.role);
    const explicitPermissions = await this.rbacService.getAdminPermissions(req.admin.id);

    return {
      role: req.admin.role,
      isSuperAdmin: req.admin.isSuperAdmin,
      rolePermissions,
      explicitPermissions: explicitPermissions.map(p => `${p.resource}:${p.action}`),
      department: req.admin.department,
      jurisdictionClearance: req.admin.jurisdictionClearance
    };
  }
}

@Controller('admin/admins')
@UseGuards(AdminAuthGuard)
export class AdminManagementController {
  constructor(
    private adminAuthService: AdminAuthService,
    private rbacService: AdminRbacService) {}

  @Post()
  @Permissions('admins:create')
  async createAdmin(@Body() createDto: CreateAdminDto) {
    return await this.adminAuthService.createAdmin(createDto);
  }

  @Get()
  @Permissions('admins:read')
  async getAdmins(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50') {
    return await this.adminAuthService.getAllAdmins(
      parseInt(page),
      parseInt(limit));
  }

  @Get(':id')
  @Permissions('admins:read')
  async getAdmin(@Param('id') id: string) {
    return await this.adminAuthService.getAdminById(id);
  }

  @Put(':id')
  @Permissions('admins:update')
  async updateAdmin(@Param('id') id: string, @Body() updateDto: UpdateAdminDto) {
    return await this.adminAuthService.updateAdmin(id, updateDto);
  }

  @Post(':id/permissions/:permissionId')
  @Permissions('admins:update', 'permissions:grant')
  async grantPermission(
    @Param('id') adminId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: { admin: AdminUser }) {
    await this.rbacService.grantPermission(adminId, permissionId, req.admin.id);
    return { message: 'Permission granted successfully' };
  }

  @Delete(':id/permissions/:permissionId')
  @Permissions('admins:update', 'permissions:revoke')
  async revokePermission(
    @Param('id') adminId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: { admin: AdminUser }) {
    await this.rbacService.revokePermission(adminId, permissionId, req.admin.id);
    return { message: 'Permission revoked successfully' };
  }

  @Get(':id/permissions')
  @Permissions('admins:read')
  async getAdminPermissions(@Param('id') id: string) {
    return await this.rbacService.getAdminPermissions(id);
  }
}

@Controller('admin/permissions')
@UseGuards(AdminAuthGuard)
export class PermissionController {
  constructor(private rbacService: AdminRbacService) {}

  @Get()
  @Permissions('permissions:read')
  async getAllPermissions() {
    return await this.rbacService.getAllPermissions();
  }

  @Get('categories')
  @Permissions('permissions:read')
  async getPermissionsByCategory(@Query('category') category: string) {
    if (category) {
      return await this.rbacService.getPermissionsByCategory(category);
    }
    return await this.rbacService.getAllPermissions();
  }

  @Get('roles')
  @Permissions('permissions:read')
  async getAllRoles() {
    return {
      roles: this.rbacService.getAllRoles(),
      rolePermissions: Object.entries(this.rbacService.getRolePermissions).map(([role, permissions]) => ({
        role,
        permissions
      }))
    };
  }

  @Post()
  @Permissions('permissions:create')
  async createPermission(
    @Body()
    permissionData: {
      name: string;
      description: string;
      resource: string;
      action: string;
      category: string;
      conditions?: Record<string, any>[];
    }) {
    return await this.rbacService.createPermission(
      permissionData.name,
      permissionData.description,
      permissionData.resource,
      permissionData.action,
      permissionData.category,
      permissionData.conditions);
  }
}
