import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Broker } from '../entities/broker.entity';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../../storage/services/s3.service';
import { EmailService } from '../../notifications/services/email.service';

export interface WhiteLabelConfig {
  branding: {
    logo: {
      url: string;
      lightModeUrl?: string;
      darkModeUrl?: string;
      favicon?: string;
    };
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
      textSecondary: string;
    };
    typography: {
      fontFamily: string;
      headingFont: string;
      bodyFont: string;
    };
    companyName: string;
    tagline?: string;
    website?: string;
    supportEmail?: string;
    supportPhone?: string;
  };
  customFeeStructure: {
    commissionRate?: number;      // Override default 30%
    transactionFeeRate?: number; // Override default rates
    minimumFee?: number;         // Minimum fee per transaction
    maximumFee?: number;         // Maximum fee per transaction
    volumeDiscounts?: Array<{
      minVolume: number;
      discountRate: number;
    }>;
    feeWaivers?: Array<{
      condition: string;
      description: string;
    }>;
  };
  features: {
    enabledModules: Array<
      'TRADING' | 'ANALYTICS' | 'SOCIAL_TRADING' | 'COPY_TRADING' |
      'RISK_MANAGEMENT' | 'PORTFOLIO_MANAGEMENT' | 'REPORTING' |
      'API_ACCESS' | 'WEBHOOKS' | 'CUSTOM_BRANDING' | 'WHITE_LABEL'
    >;
    customDomains: Array<{
      domain: string;
      ssl: boolean;
      customEmail: boolean;
    }>;
    integrations: Array<{
      type: 'PAYMENT_GATEWAY' | 'ANALYTICS' | 'CRM' | 'EMAIL' | 'SMS';
      provider: string;
      config: Record<string, any>;
    }>;
  };
  compliance: {
    customDisclaimer?: string;
    riskWarnings: string[];
    regulatoryInfo: {
      fscaLicense?: string;
      providerLicense?: string;
      jurisdiction: string;
    };
    dataPrivacy: {
      privacyPolicyUrl?: string;
      gdprCompliant: boolean;
      dataRetentionPeriod: number; // days
    };
  };
  ui: {
    customComponents?: Array<{
      name: string;
      type: 'HEADER' | 'FOOTER' | 'SIDEBAR' | 'DASHBOARD_WIDGET';
      content: string;
      position: string;
    }>;
    layout: {
      sidebarPosition: 'LEFT' | 'RIGHT' | 'HIDDEN';
      headerStyle: 'MINIMAL' | 'DETAILED' | 'CUSTOM';
      footerEnabled: boolean;
    };
    customCSS?: string;
    customJS?: string;
  };
}

export interface WhiteLabelDeployment {
  brokerId: string;
  subdomain: string;
  customDomain?: string;
  config: WhiteLabelConfig;
  deploymentStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'FAILED';
  deploymentDate: Date;
  sslStatus: 'PENDING' | 'ACTIVE' | 'FAILED';
  analytics: {
    visitors: number;
    pageViews: number;
    signups: number;
    conversions: number;
  };
}

export interface WhiteLabelTemplate {
  id: string;
  name: string;
  description: string;
  category: 'PROFESSIONAL' | 'MODERN' | 'MINIMAL' | 'CORPORATE' | 'CREATIVE';
  preview: {
    thumbnail: string;
    screenshots: string[];
  };
  config: Partial<WhiteLabelConfig>;
  popularity: number;
  isPremium: boolean;
}

@Injectable()
export class WhiteLabelService {
  private readonly logger = new Logger(WhiteLabelService.name);

  constructor(
    @InjectRepository(Broker)
    private brokerRepository: Repository<Broker>,
    private configService: ConfigService,
    private s3Service: S3Service,
    private emailService: EmailService,
  ) {}

  async createWhiteLabelConfig(
    brokerId: string,
    templateId?: string,
    customConfig?: Partial<WhiteLabelConfig>
  ): Promise<WhiteLabelConfig> {
    this.logger.log(`Creating white-label config for broker ${brokerId}`);

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    // Check if broker is eligible for white-label
    if (broker.tier !== 'ENTERPRISE') {
      throw new Error('White-label options are only available for Enterprise tier brokers');
    }

    let config: WhiteLabelConfig;

    if (templateId) {
      // Use predefined template
      const template = await this.getTemplate(templateId);
      config = { ...template.config, ...customConfig } as WhiteLabelConfig;
    } else {
      // Use default configuration
      config = await this.getDefaultConfig(broker);
      if (customConfig) {
        config = this.mergeConfigs(config, customConfig);
      }
    }

    // Validate configuration
    await this.validateConfig(config);

    // Store configuration
    await this.storeConfig(brokerId, config);

    this.logger.log(`White-label config created for broker ${brokerId}`);
    return config;
  }

  async getDefaultConfig(broker: Broker): Promise<WhiteLabelConfig> {
    return {
      branding: {
        logo: {
          url: this.configService.get<string>('DEFAULT_LOGO_URL', '/assets/default-logo.png'),
        },
        colors: {
          primary: '#3B82F6',      // Blue
          secondary: '#6366F1',    // Indigo
          accent: '#F59E0B',       // Amber
          background: '#FFFFFF',
          surface: '#F9FAFB',
          text: '#111827',
          textSecondary: '#6B7280',
        },
        typography: {
          fontFamily: 'Inter, system-ui, sans-serif',
          headingFont: 'Inter, system-ui, sans-serif',
          bodyFont: 'Inter, system-ui, sans-serif',
        },
        companyName: broker.companyName,
        tagline: 'Social Momentum Trading Platform',
        website: broker.companyWebsite,
        supportEmail: broker.complianceInfo.contactEmail,
      },
      customFeeStructure: {
        commissionRate: 0.3,           // 30% default
        transactionFeeRate: 0.0025,    // 0.25% default
        minimumFee: 10,               // R10 minimum
        maximumFee: 1000,             // R1000 maximum
        volumeDiscounts: [
          { minVolume: 1000000, discountRate: 0.02 },
          { minVolume: 5000000, discountRate: 0.05 },
        ],
      },
      features: {
        enabledModules: [
          'TRADING', 'ANALYTICS', 'SOCIAL_TRADING', 'RISK_MANAGEMENT',
          'PORTFOLIO_MANAGEMENT', 'REPORTING', 'API_ACCESS'
        ],
        customDomains: [],
        integrations: [],
      },
      compliance: {
        riskWarnings: [
          'Trading carries a high level of risk to your capital.',
          'Past performance is not indicative of future results.',
          'Only trade with money you can afford to lose.',
        ],
        regulatoryInfo: {
          fscaLicense: broker.fscaLicenseNumber,
          jurisdiction: 'South Africa',
        },
        dataPrivacy: {
          gdprCompliant: true,
          dataRetentionPeriod: 2555, // 7 years
        },
      },
      ui: {
        layout: {
          sidebarPosition: 'LEFT',
          headerStyle: 'DETAILED',
          footerEnabled: true,
        },
      },
    };
  }

  async getTemplates(category?: string): Promise<WhiteLabelTemplate[]> {
    const templates: WhiteLabelTemplate[] = [
      {
        id: 'modern-blue',
        name: 'Modern Blue',
        description: 'Clean, professional design with blue accent colors',
        category: 'MODERN',
        preview: {
          thumbnail: '/assets/templates/modern-blue-thumb.png',
          screenshots: ['/assets/templates/modern-blue-1.png'],
        },
        config: {
          branding: {
            colors: {
              primary: '#2563EB',
              secondary: '#1E40AF',
              accent: '#60A5FA',
              background: '#FFFFFF',
              surface: '#F3F4F6',
              text: '#1F2937',
              textSecondary: '#6B7280',
            },
          },
        },
        popularity: 85,
        isPremium: false,
      },
      {
        id: 'minimal-dark',
        name: 'Minimal Dark',
        description: 'Sleek dark theme with minimal aesthetics',
        category: 'MINIMAL',
        preview: {
          thumbnail: '/assets/templates/minimal-dark-thumb.png',
          screenshots: ['/assets/templates/minimal-dark-1.png'],
        },
        config: {
          branding: {
            colors: {
              primary: '#8B5CF6',
              secondary: '#7C3AED',
              accent: '#A78BFA',
              background: '#111827',
              surface: '#1F2937',
              text: '#F9FAFB',
              textSecondary: '#D1D5DB',
            },
          },
        },
        popularity: 72,
        isPremium: true,
      },
      {
        id: 'corporate-green',
        name: 'Corporate Green',
        description: 'Traditional corporate styling with green accents',
        category: 'CORPORATE',
        preview: {
          thumbnail: '/assets/templates/corporate-green-thumb.png',
          screenshots: ['/assets/templates/corporate-green-1.png'],
        },
        config: {
          branding: {
            colors: {
              primary: '#059669',
              secondary: '#047857',
              accent: '#34D399',
              background: '#FFFFFF',
              surface: '#F0FDF4',
              text: '#064E3B',
              textSecondary: '#6B7280',
            },
          },
        },
        popularity: 65,
        isPremium: false,
      },
    ];

    if (category) {
      return templates.filter(t => t.category === category);
    }

    return templates;
  }

  async getTemplate(templateId: string): Promise<WhiteLabelTemplate> {
    const templates = await this.getTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return template;
  }

  async updateWhiteLabelConfig(
    brokerId: string,
    updates: Partial<WhiteLabelConfig>
  ): Promise<WhiteLabelConfig> {
    this.logger.log(`Updating white-label config for broker ${brokerId}`);

    const existingConfig = await this.getConfig(brokerId);
    const updatedConfig = this.mergeConfigs(existingConfig, updates);

    await this.validateConfig(updatedConfig);
    await this.storeConfig(brokerId, updatedConfig);

    return updatedConfig;
  }

  async deployWhiteLabel(
    brokerId: string,
    subdomain: string,
    customDomain?: string
  ): Promise<WhiteLabelDeployment> {
    this.logger.log(`Deploying white-label for broker ${brokerId} on ${subdomain}`);

    const config = await this.getConfig(brokerId);
    const deployment: WhiteLabelDeployment = {
      brokerId,
      subdomain,
      customDomain,
      config,
      deploymentStatus: 'PENDING',
      deploymentDate: new Date(),
      sslStatus: customDomain ? 'PENDING' : 'ACTIVE',
      analytics: {
        visitors: 0,
        pageViews: 0,
        signups: 0,
        conversions: 0,
      },
    };

    try {
      // In a real implementation, this would:
      // 1. Configure DNS records
      // 2. Set up SSL certificates
      // 3. Deploy custom assets
      // 4. Configure load balancer
      // 5. Set up analytics tracking

      // Simulate deployment process
      await this.performDeployment(deployment);

      deployment.deploymentStatus = 'ACTIVE';
      deployment.sslStatus = 'ACTIVE';

      // Send deployment confirmation
      await this.sendDeploymentConfirmation(brokerId, deployment);

      this.logger.log(`White-label deployment completed for broker ${brokerId}`);
    } catch (error) {
      this.logger.error(`White-label deployment failed for broker ${brokerId}:`, error);
      deployment.deploymentStatus = 'FAILED';
      throw error;
    }

    return deployment;
  }

  async uploadBrandingAsset(
    brokerId: string,
    file: Express.Multer.File,
    assetType: 'logo' | 'favicon' | 'background'
  ): Promise<{ url: string; key: string }> {
    this.logger.log(`Uploading ${assetType} for broker ${brokerId}`);

    const key = `white-label/${brokerId}/${assetType}/${file.originalname}`;

    // Upload to S3 or other storage service
    const result = await this.s3Service.uploadFile(key, file.buffer, {
      contentType: file.mimetype,
      acl: 'public-read',
    });

    return {
      url: result.url,
      key: result.key,
    };
  }

  async generateCustomCSS(config: WhiteLabelConfig): Promise<string> {
    const { branding, ui } = config;

    return `
/* Custom CSS for ${branding.companyName} */

:root {
  --color-primary: ${branding.colors.primary};
  --color-secondary: ${branding.colors.secondary};
  --color-accent: ${branding.colors.accent};
  --color-background: ${branding.colors.background};
  --color-surface: ${branding.colors.surface};
  --color-text: ${branding.colors.text};
  --color-text-secondary: ${branding.colors.textSecondary};
  --font-family: ${branding.typography.fontFamily};
  --font-heading: ${branding.typography.headingFont};
  --font-body: ${branding.typography.bodyFont};
}

body {
  font-family: var(--font-body);
  background-color: var(--color-background);
  color: var(--color-text);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

.btn-primary {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.btn-secondary {
  background-color: var(--color-secondary);
  border-color: var(--color-secondary);
}

.btn-accent {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
}

.card {
  background-color: var(--color-surface);
}

.logo {
  content: url('${branding.logo.url}');
}

${ui.customCSS || ''}
    `.trim();
  }

  async validateConfig(config: WhiteLabelConfig): Promise<void> {
    const errors: string[] = [];

    // Validate colors
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    Object.entries(config.branding.colors).forEach(([key, value]) => {
      if (!colorRegex.test(value)) {
        errors.push(`Invalid color format for ${key}: ${value}`);
      }
    });

    // Validate commission rates
    if (config.customFeeStructure.commissionRate) {
      if (config.customFeeStructure.commissionRate < 0.1 || config.customFeeStructure.commissionRate > 0.5) {
        errors.push('Commission rate must be between 10% and 50%');
      }
    }

    // Validate custom domains
    if (config.features.customDomains) {
      for (const domain of config.features.customDomains) {
        if (!this.isValidDomain(domain.domain)) {
          errors.push(`Invalid domain format: ${domain.domain}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  private mergeConfigs(base: WhiteLabelConfig, updates: Partial<WhiteLabelConfig>): WhiteLabelConfig {
    return {
      ...base,
      ...updates,
      branding: { ...base.branding, ...updates.branding },
      customFeeStructure: { ...base.customFeeStructure, ...updates.customFeeStructure },
      features: { ...base.features, ...updates.features },
      compliance: { ...base.compliance, ...updates.compliance },
      ui: { ...base.ui, ...updates.ui },
    };
  }

  private async getConfig(brokerId: string): Promise<WhiteLabelConfig> {
    // In a real implementation, this would fetch from database
    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    return this.getDefaultConfig(broker);
  }

  private async storeConfig(brokerId: string, config: WhiteLabelConfig): Promise<void> {
    // In a real implementation, this would store in database
    this.logger.log(`Storing config for broker ${brokerId}`);
  }

  private async performDeployment(deployment: WhiteLabelDeployment): Promise<void> {
    // Simulate deployment time
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async sendDeploymentConfirmation(brokerId: string, deployment: WhiteLabelDeployment): Promise<void> {
    // In a real implementation, this would send email notification
    this.logger.log(`Deployment confirmation sent to broker ${brokerId}`);
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    return domainRegex.test(domain);
  }

  async getDeploymentAnalytics(brokerId: string): Promise<any> {
    // In a real implementation, this would fetch analytics data
    return {
      visitors: Math.floor(Math.random() * 10000) + 1000,
      pageViews: Math.floor(Math.random() * 50000) + 5000,
      signups: Math.floor(Math.random() * 100) + 10,
      conversions: Math.floor(Math.random() * 20) + 2,
      bounceRate: Math.random() * 0.3 + 0.2,
      avgSessionDuration: Math.floor(Math.random() * 300) + 60, // seconds
      topPages: [
        { path: '/', views: Math.floor(Math.random() * 1000) + 500 },
        { path: '/dashboard', views: Math.floor(Math.random() * 500) + 200 },
        { path: '/trading', views: Math.floor(Math.random() * 300) + 100 },
      ],
    };
  }
}