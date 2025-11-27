import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  SetMetadata,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { ApiProduct, ProductWithPlans } from '../interfaces/api-marketplace.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('API Marketplace - Products')
@Controller('api/v1/api-marketplace/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @Permissions('api:products:create')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(20, 60) // 20 requests per minute
  @ApiOperation({ summary: 'Create a new API product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async createProduct(
    @Body(ValidationPipe) dto: CreateProductDto,
  ): Promise<ApiProduct> {
    return this.productsService.createProduct(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle(100, 60) // 100 requests per minute
  @ApiOperation({ summary: 'List all API products' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'active', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async listProducts(
    @Query('category') category?: string,
    @Query('active') active?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{
    products: ProductWithPlans[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const filters: any = {};
    if (category) filters.category = category;
    if (active !== undefined) filters.active = active === 'true';
    if (page) filters.page = page;
    if (limit) filters.limit = limit;

    return this.productsService.listProducts(filters);
  }

  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  @Throttle(100, 60) // 100 requests per minute
  @ApiOperation({ summary: 'Get product details by slug' })
  @ApiParam({ name: 'slug', description: 'Product slug' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProduct(
    @Param('slug') slug: string,
  ): Promise<ProductWithPlans | null> {
    return this.productsService.getProduct(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @Permissions('api:products:update')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60) // 20 requests per minute
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: Partial<CreateProductDto>,
  ): Promise<ApiProduct> {
    return this.productsService.updateProduct(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @Permissions('api:products:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(10, 60) // 10 requests per minute
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 204, description: 'Product deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async deleteProduct(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.productsService.deleteProduct(id);
  }

  @Get(':id/plans')
  @HttpCode(HttpStatus.OK)
  @Throttle(100, 60) // 100 requests per minute
  @ApiOperation({ summary: 'Get all plans for a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductPlans(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<any[]> {
    return this.productsService.getProductPlans(id);
  }

  @Get(':id/usage')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @Permissions('api:products:analytics')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60) // 20 requests per minute
  @ApiOperation({ summary: 'Get product usage statistics' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async getProductUsageStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date(),
      };
    }

    return this.productsService.getProductUsageStats(id, dateRange);
  }
}