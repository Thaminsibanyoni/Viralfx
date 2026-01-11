import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  ValidationPipe,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { WhiteLabelService } from '../services/white-label.service';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BrokerAuthGuard } from '../guards/broker-auth.guard';
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { User } from "../../../common/enums/user-role.enum";
import { IsOptional, IsString, IsEnum, IsUrl, IsArray, IsObject } from 'class-validator';

enum WhiteLabelCategory {
  PROFESSIONAL = 'PROFESSIONAL',
  MODERN = 'MODERN',
  MINIMAL = 'MINIMAL',
  CORPORATE = 'CORPORATE',
  CREATIVE = 'CREATIVE'
}

class CreateWhiteLabelDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  customConfig?: any;
}

class UpdateWhiteLabelDto {
  @IsOptional()
  @IsObject()
  branding?: {
    logo?: {
      url: string;
      lightModeUrl?: string;
      darkModeUrl?: string;
      favicon?: string;
    };
    colors?: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
      textSecondary: string;
    };
    typography?: {
      fontFamily: string;
      headingFont: string;
      bodyFont: string;
    };
    companyName?: string;
    tagline?: string;
    website?: string;
    supportEmail?: string;
    supportPhone?: string;
  };

  @IsOptional()
  @IsObject()
  customFeeStructure?: {
    commissionRate?: number;
    transactionFeeRate?: number;
    minimumFee?: number;
    maximumFee?: number;
    volumeDiscounts?: Array<{
      minVolume: number;
      discountRate: number;
    }>;
    feeWaivers?: Array<{
      condition: string;
      description: string;
    }>;
  };

  @IsOptional()
  @IsObject()
  features?: {
    enabledModules?: string[];
    customDomains?: Array<{
      domain: string;
      ssl: boolean;
      customEmail: boolean;
    }>;
    integrations?: Array<{
      type: string;
      provider: string;
      config: Record<string, any>;
    }>;
  };

  @IsOptional()
  @IsObject()
  ui?: {
    customComponents?: Array<{
      name: string;
      type: string;
      content: string;
      position: string;
    }>;
    layout?: {
      sidebarPosition: string;
      headerStyle: string;
      footerEnabled: boolean;
    };
    customCSS?: string;
    customJS?: string;
  };
}

class DeployWhiteLabelDto {
  @IsString()
  subdomain: string;

  @IsOptional()
  @IsUrl()
  customDomain?: string;
}

class UploadAssetDto {
  @IsEnum(['logo', 'favicon', 'background'], {
    message: 'Asset type must be one of: logo, favicon, background'
  })
  assetType: 'logo' | 'favicon' | 'background';
}

@ApiTags('White Label')
@Controller('brokers/white-label')
@UseGuards(JwtAuthGuard, BrokerAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WhiteLabelController {
  constructor(private readonly whiteLabelService: WhiteLabelService) {}

  @Get('templates')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get available white-label templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(@Query('category') category?: WhiteLabelCategory) {
    const templates = await this.whiteLabelService.getTemplates(category);

    return {
      statusCode: HttpStatus.OK,
      message: 'Templates retrieved successfully',
      data: {
        templates,
        categories: Object.values(WhiteLabelCategory)
      }
    };
  }

  @Get('templates/:templateId')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get specific template details' })
  @ApiResponse({ status: 200, description: 'Template details retrieved successfully' })
  async getTemplate(@Param('templateId') templateId: string) {
    const template = await this.whiteLabelService.getTemplate(templateId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Template details retrieved successfully',
      data: template
    };
  }

  @Post('config')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Create white-label configuration' })
  @ApiResponse({ status: 201, description: 'Configuration created successfully' })
  async createConfig(
    @Body(ValidationPipe) createDto: CreateWhiteLabelDto,
    @CurrentUser() user: User
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const config = await this.whiteLabelService.createWhiteLabelConfig(
      user.brokerId,
      createDto.templateId,
      createDto.customConfig
    );

    return {
      statusCode: HttpStatus.CREATED,
      message: 'White-label configuration created successfully',
      data: config
    };
  }

  @Get('config')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get current white-label configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved successfully' })
  async getConfig(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const config = await this.whiteLabelService.getConfig(user.brokerId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Configuration retrieved successfully',
      data: config
    };
  }

  @Put('config')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Update white-label configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  async updateConfig(
    @Body(ValidationPipe) updateDto: UpdateWhiteLabelDto,
    @CurrentUser() user: User
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const config = await this.whiteLabelService.updateWhiteLabelConfig(
      user.brokerId,
      updateDto
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Configuration updated successfully',
      data: config
    };
  }

  @Post('deploy')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Deploy white-label site' })
  @ApiResponse({ status: 200, description: 'Deployment initiated successfully' })
  async deploy(
    @Body(ValidationPipe) deployDto: DeployWhiteLabelDto,
    @CurrentUser() user: User
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const deployment = await this.whiteLabelService.deployWhiteLabel(
      user.brokerId,
      deployDto.subdomain,
      deployDto.customDomain
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Deployment initiated successfully',
      data: deployment
    };
  }

  @Post('upload-asset')
  @Roles('ADMIN', 'BROKER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload branding asset' })
  @ApiResponse({ status: 200, description: 'Asset uploaded successfully' })
  async uploadAsset(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|svg|ico)$/ }),
        ]
      }))
    file: Express.Multer.File,
    @Body(ValidationPipe) uploadDto: UploadAssetDto,
    @CurrentUser() user: User
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const result = await this.whiteLabelService.uploadBrandingAsset(
      user.brokerId,
      file,
      uploadDto.assetType
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Asset uploaded successfully',
      data: result
    };
  }

  @Get('css')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Generate custom CSS' })
  @ApiResponse({ status: 200, description: 'CSS generated successfully' })
  async generateCustomCSS(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const config = await this.whiteLabelService.getConfig(user.brokerId);
    const css = await this.whiteLabelService.generateCustomCSS(config);

    return {
      statusCode: HttpStatus.OK,
      message: 'Custom CSS generated successfully',
      data: {
        css,
        contentType: 'text/css'
      }
    };
  }

  @Get('analytics')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get deployment analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const analytics = await this.whiteLabelService.getDeploymentAnalytics(user.brokerId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Analytics retrieved successfully',
      data: analytics
    };
  }

  @Get('preview')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get white-label preview' })
  @ApiResponse({ status: 200, description: 'Preview generated successfully' })
  async getPreview(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const config = await this.whiteLabelService.getConfig(user.brokerId);
    const css = await this.whiteLabelService.generateCustomCSS(config);

    return {
      statusCode: HttpStatus.OK,
      message: 'Preview generated successfully',
      data: {
        config,
        css,
        previewUrl: `${process.env.API_BASE_URL}/white-label/${user.brokerId}/preview`
      }
    };
  }

  @Post('validate-config')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Validate white-label configuration' })
  @ApiResponse({ status: 200, description: 'Configuration validated successfully' })
  async validateConfig(
    @Body() config: any,
    @CurrentUser() user: User
  ) {
    try {
      await this.whiteLabelService.validateConfig(config);

      return {
        statusCode: HttpStatus.OK,
        message: 'Configuration is valid',
        data: {
          isValid: true,
          errors: []
        }
      };
    } catch (error) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Configuration validation failed',
        data: {
          isValid: false,
          errors: [error.message]
        }
      };
    }
  }

  @Get('domains/available')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Check if subdomain is available' })
  @ApiResponse({ status: 200, description: 'Domain availability checked' })
  async checkDomainAvailability(@Query('subdomain') subdomain: string) {
    // In a real implementation, this would check against deployed domains
    const isAvailable = Math.random() > 0.3; // 70% chance of being available

    return {
      statusCode: HttpStatus.OK,
      message: 'Domain availability checked',
      data: {
        subdomain,
        isAvailable,
        suggestedDomains: isAvailable ? [] : [
          `${subdomain}-trading`,
          `${subdomain}-platform`,
          `${subdomain}-fx`,
          `${subdomain}-social`,
        ]
      }
    };
  }

  @Get('features/available')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get available white-label features' })
  @ApiResponse({ status: 200, description: 'Available features retrieved' })
  async getAvailableFeatures(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const features = {
      modules: [
        { key: 'TRADING', name: 'Trading Platform', description: 'Full trading functionality' },
        { key: 'ANALYTICS', name: 'Analytics Dashboard', description: 'Advanced analytics and reporting' },
        { key: 'SOCIAL_TRADING', name: 'Social Trading', description: 'Social features and community' },
        { key: 'COPY_TRADING', name: 'Copy Trading', description: 'Copy successful traders' },
        { key: 'RISK_MANAGEMENT', name: 'Risk Management', description: 'Advanced risk controls' },
        { key: 'PORTFOLIO_MANAGEMENT', name: 'Portfolio Management', description: 'Portfolio tracking and tools' },
        { key: 'REPORTING', name: 'Reporting', description: 'Custom reports and insights' },
        { key: 'API_ACCESS', name: 'API Access', description: 'REST API for integration' },
        { key: 'WEBHOOKS', name: 'Webhooks', description: 'Real-time webhook notifications' },
        { key: 'CUSTOM_BRANDING', name: 'Custom Branding', description: 'Full brand customization' },
        { key: 'WHITE_LABEL', name: 'White Label', description: 'Complete white-label solution' },
      ],
      integrations: [
        { type: 'PAYMENT_GATEWAY', providers: ['STRIPE', 'PAYPAL', 'YOCO'] },
        { type: 'ANALYTICS', providers: ['GOOGLE_ANALYTICS', 'MIXPANEL', 'AMPLITUDE'] },
        { type: 'CRM', providers: ['SALESFORCE', 'HUBSPOT', 'PIPEDRIVE'] },
        { type: 'EMAIL', providers: ['SENDGRID', 'MAILGUN', 'AWS_SES'] },
        { type: 'SMS', providers: ['TWILIO', 'AWS_SNS', 'MESSAGEBIRD'] },
      ],
      tierLimits: {
        STARTER: {
          maxCustomDomains: 0,
          maxIntegrations: 2,
          allowedModules: ['TRADING', 'ANALYTICS']
        },
        PROFESSIONAL: {
          maxCustomDomains: 1,
          maxIntegrations: 5,
          allowedModules: ['TRADING', 'ANALYTICS', 'SOCIAL_TRADING', 'RISK_MANAGEMENT']
        },
        ENTERPRISE: {
          maxCustomDomains: -1, // Unlimited
          maxIntegrations: -1, // Unlimited
          allowedModules: '*' // All modules
        }
      }
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Available features retrieved successfully',
      data: features
    };
  }
}
