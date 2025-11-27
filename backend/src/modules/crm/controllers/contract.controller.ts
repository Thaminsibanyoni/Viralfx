import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ContractService } from '../services/contract.service';
import { UserRole } from '../../users/entities/user.entity';
import { CreateContractDto } from '../dto/create-contract.dto';
import { UpdateContractDto } from '../dto/update-contract.dto';
import { ContractFiltersDto } from '../dto/contract-filters.dto';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES, UserRole.LEGAL)
  @ApiOperation({ summary: 'Get all contracts with filters' })
  @ApiResponse({ status: 200, description: 'Contracts retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by assigned manager' })
  @ApiQuery({ name: 'brokerId', required: false, type: String, description: 'Filter by broker' })
  async getContracts(@Query() query: ContractFiltersDto) {
    const result = await this.contractService.getContracts(query);

    return {
      success: true,
      data: result.contracts,
      pagination: result.pagination,
      filters: result.filters,
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES, UserRole.LEGAL)
  @ApiOperation({ summary: 'Get contract by ID' })
  @ApiResponse({ status: 200, description: 'Contract retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async getContractById(@Param('id') id: string) {
    const contract = await this.contractService.getContractById(id);

    return {
      success: true,
      data: contract,
    };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @ApiOperation({ summary: 'Create new contract' })
  @ApiResponse({ status: 201, description: 'Contract created successfully' })
  async createContract(@Body(ValidationPipe) createContractDto: CreateContractDto) {
    const contract = await this.contractService.createContract(createContractDto);

    return {
      success: true,
      message: 'Contract created successfully',
      data: contract,
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES, UserRole.LEGAL)
  @ApiOperation({ summary: 'Update contract' })
  @ApiResponse({ status: 200, description: 'Contract updated successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async updateContract(
    @Param('id') id: string,
    @Body(ValidationPipe) updateContractDto: UpdateContractDto
  ) {
    const contract = await this.contractService.updateContract(id, updateContractDto);

    return {
      success: true,
      message: 'Contract updated successfully',
      data: contract,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete contract' })
  @ApiResponse({ status: 200, description: 'Contract deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async deleteContract(@Param('id') id: string) {
    await this.contractService.deleteContract(id);

    return {
      success: true,
      message: 'Contract deleted successfully',
    };
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LEGAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update contract status' })
  @ApiResponse({ status: 200, description: 'Contract status updated successfully' })
  async updateContractStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string }
  ) {
    const contract = await this.contractService.updateContractStatus(id, body.status, body.notes);

    return {
      success: true,
      message: 'Contract status updated successfully',
      data: contract,
    };
  }

  @Post(':id/sign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LEGAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark contract as signed' })
  @ApiResponse({ status: 200, description: 'Contract marked as signed successfully' })
  async signContract(
    @Param('id') id: string,
    @Body() body: { signedAt?: string; signedBy?: string; notes?: string }
  ) {
    const contract = await this.contractService.signContract(
      id,
      body.signedAt ? new Date(body.signedAt) : new Date(),
      body.signedBy,
      body.notes
    );

    return {
      success: true,
      message: 'Contract signed successfully',
      data: contract,
    };
  }

  @Post(':id/terminate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LEGAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminate contract' })
  @ApiResponse({ status: 200, description: 'Contract terminated successfully' })
  async terminateContract(
    @Param('id') id: string,
    @Body() body: { terminationReason: string; terminationDate?: string; notes?: string }
  ) {
    const contract = await this.contractService.terminateContract(
      id,
      body.terminationReason,
      body.terminationDate ? new Date(body.terminationDate) : new Date(),
      body.notes
    );

    return {
      success: true,
      message: 'Contract terminated successfully',
      data: contract,
    };
  }

  @Post(':id/renew')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renew contract' })
  @ApiResponse({ status: 200, description: 'Contract renewed successfully' })
  async renewContract(
    @Param('id') id: string,
    @Body() body: { newEndDate: string; renewalTerms?: string; notes?: string }
  ) {
    const contract = await this.contractService.renewContract(
      id,
      new Date(body.newEndDate),
      body.renewalTerms,
      body.notes
    );

    return {
      success: true,
      message: 'Contract renewed successfully',
      data: contract,
    };
  }

  @Get(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES, UserRole.LEGAL)
  @ApiOperation({ summary: 'Get contract documents' })
  @ApiResponse({ status: 200, description: 'Contract documents retrieved successfully' })
  async getContractDocuments(@Param('id') id: string) {
    const documents = await this.contractService.getContractDocuments(id);

    return {
      success: true,
      data: documents,
    };
  }

  @Post(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES, UserRole.LEGAL)
  @ApiOperation({ summary: 'Upload contract document' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  async uploadContractDocument(
    @Param('id') id: string,
    @Body() body: { name: string; url: string; type: string; size?: number }
  ) {
    const document = await this.contractService.uploadContractDocument(id, {
      name: body.name,
      url: body.url,
      type: body.type,
      size: body.size,
    });

    return {
      success: true,
      message: 'Document uploaded successfully',
      data: document,
    };
  }

  @Delete(':id/documents/:documentId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LEGAL)
  @ApiOperation({ summary: 'Delete contract document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteContractDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string
  ) {
    await this.contractService.deleteContractDocument(id, documentId);

    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }

  @Get('export/csv')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES, UserRole.LEGAL)
  @ApiOperation({ summary: 'Export contracts to CSV' })
  @ApiResponse({ status: 200, description: 'Contracts exported successfully' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  @ApiQuery({ name: 'assignedTo', required: false, type: String, description: 'Filter by assigned manager' })
  @ApiQuery({ name: 'brokerId', required: false, type: String, description: 'Filter by broker' })
  @ApiQuery({ name: 'dateRange', required: false, type: String, description: 'Date range filter (JSON)' })
  async exportContracts(@Query() query: any) {
    const filters = {
      ...(query.status && { status: query.status }),
      ...(query.assignedTo && { assignedTo: query.assignedTo }),
      ...(query.brokerId && { brokerId: query.brokerId }),
      ...(query.dateRange && { dateRange: JSON.parse(query.dateRange) }),
    };

    const csvData = await this.contractService.exportContracts(filters);

    return {
      success: true,
      data: csvData,
    };
  }

  @Get('stats/overview')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES, UserRole.LEGAL)
  @ApiOperation({ summary: 'Get contract statistics overview' })
  @ApiResponse({ status: 200, description: 'Contract statistics retrieved successfully' })
  @ApiQuery({ name: 'period', required: false, type: String, description: 'Time period (day/week/month/year)', example: 'month' })
  async getContractStats(@Query('period') period: string = 'month') {
    const stats = await this.contractService.getContractStats(period);

    return {
      success: true,
      data: stats,
    };
  }

  @Get('expiring')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES, UserRole.LEGAL)
  @ApiOperation({ summary: 'Get contracts expiring soon' })
  @ApiResponse({ status: 200, description: 'Expiring contracts retrieved successfully' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Days until expiry', example: 30 })
  async getExpiringContracts(@Query('days') days: number = 30) {
    const contracts = await this.contractService.getExpiringContracts(days);

    return {
      success: true,
      data: contracts,
    };
  }
}