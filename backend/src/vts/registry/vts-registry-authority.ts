/**
 * VTS Registry Authority (VRA) - Global Master Database
 * Central authority for VTS symbol registration, lifecycle, and governance
 * © 2025 ViralFX - Global Registry Authority
 */

import { createHash } from 'crypto';
import { logger } from "../../common/logger";
import { VTSSymbol, RegionCode, CategoryCode, VerificationLevel, RiskLevel } from "../../types/vts";

export interface VTSRegistration {
  id: string;
  symbol: string;
  alias?: string;
  status: VTSRegistrationStatus;
  ownership: VTSOwnership;
  lifecycle: VTSLifecycle;
  governance: VTSGovernance;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  auditLog: VTSAuditEntry[];
}

export interface VTSOwnership {
  createdBy: string; // Regional registry ID
  region: RegionCode;
  verified: boolean;
  stewardship: string[]; // Additional responsible parties
}

export interface VTSLifecycle {
  creationDate: Date;
  verificationDate?: Date;
  marketEligibilityDate?: Date;
  lastActiveDate: Date;
  expirationDate?: Date;
  archivalDate?: Date;
  reactivationCount: number;
  version: number;
  parentSymbol?: string; // For evolved topics
  childSymbols: string[]; // For split topics
}

export interface VTSGovernance {
  tradingEligibility: boolean;
  riskLevel: RiskLevel;
  requiredVerification: VerificationLevel;
  regionalApprovals: RegionalApproval[];
  complianceChecks: ComplianceCheck[];
  restrictionFlags: RestrictionFlag[];
}

export interface RegionalApproval {
  region: RegionCode;
  approved: boolean;
  approvedBy: string;
  approvedAt: Date;
  notes?: string;
}

export interface ComplianceCheck {
  checkType: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'REVIEW';
  checkedBy: string;
  checkedAt: Date;
  details?: any;
}

export interface RestrictionFlag {
  type: 'AGE_RESTRICTED' | 'REGION_RESTRICTED' | 'CONTENT_WARNING' | 'TRADING_RESTRICTED';
  scope: string[]; // Regions, age groups, etc.
  reason: string;
  appliedAt: Date;
  expiresAt?: Date;
}

export interface VTSAuditEntry {
  id: string;
  timestamp: Date;
  action: VTSAuditAction;
  actor: string;
  region: RegionCode;
  details: any;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  userAgent?: string;
}

export enum VTSRegistrationStatus {
  DRAFT = 'DRAFT',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  MARKET_ELIGIBLE = 'MARKET_ELIGIBLE',
  ACTIVE = 'ACTIVE',
  RESTRICTED = 'RESTRICTED',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
  DEPRECATED = 'DEPRECATED'
}

export enum VTSAuditAction {
  SYMBOL_CREATED = 'SYMBOL_CREATED',
  SYMBOL_UPDATED = 'SYMBOL_UPDATED',
  VERIFICATION_GRANTED = 'VERIFICATION_GRANTED',
  VERIFICATION_REVOKED = 'VERIFICATION_REVOKED',
  TRADING_ENABLED = 'TRADING_ENABLED',
  TRADING_DISABLED = 'TRADING_DISABLED',
  RESTRICTION_ADDED = 'RESTRICTION_ADDED',
  RESTRICTION_REMOVED = 'RESTRICTION_REMOVED',
  SYMBOL_MERGED = 'SYMBOL_MERGED',
  SYMBOL_SPLIT = 'SYMBOL_SPLIT',
  SYMBOL_VERSIONED = 'SYMBOL_VERSIONED',
  SYMBOL_REACTIVATED = 'SYMBOL_REACTIVATED',
  SYMBOL_ARCHIVED = 'SYMBOL_ARCHIVED'
}

export class VTSRegistryAuthority {
  private static instance: VTSRegistryAuthority;
  private registrations: Map<string, VTSRegistration> = new Map();
  private regionalRegistrars: Map<RegionCode, VTSRegionalRegistrar> = new Map();
  private symbolAliases: Map<string, string> = new Map(); // alias -> symbol
  private conflictResolver: VTSSymbolConflictResolver;
  private governanceEngine: VTSGovernanceEngine;

  private constructor() {
    this.conflictResolver = new VTSSymbolConflictResolver();
    this.governanceEngine = new VTSGovernanceEngine();
    this.initializeRegionalRegistrars();
  }

  static getInstance(): VTSRegistryAuthority {
    if (!VTSRegistryAuthority.instance) {
      VTSRegistryAuthority.instance = new VTSRegistryAuthority();
    }
    return VTSRegistryAuthority.instance;
  }

  /**
   * Register a new VTS symbol
   */
  async registerSymbol(request: VTSRegistrationRequest): Promise<VTSRegistration> {
    logger.info(`Registering VTS symbol: ${request.symbol}`, { region: request.region });

    // Check for conflicts
    const conflictCheck = await this.conflictResolver.checkConflicts(request);
    if (conflictCheck.hasConflict) {
      throw new Error(`Symbol conflict detected: ${conflictCheck.conflictReason}`);
    }

    // Create registration
    const registration: VTSRegistration = {
      id: this.generateRegistrationId(),
      symbol: request.symbol,
      alias: request.alias,
      status: VTSRegistrationStatus.PENDING_VERIFICATION,
      ownership: {
        createdBy: request.createdBy,
        region: request.region,
        verified: false,
        stewardship: []
      },
      lifecycle: {
        creationDate: new Date(),
        lastActiveDate: new Date(),
        reactivationCount: 0,
        version: 1
      },
      governance: {
        tradingEligibility: false,
        riskLevel: RiskLevel.LOW,
        requiredVerification: VerificationLevel.LOW,
        regionalApprovals: [],
        complianceChecks: [],
        restrictionFlags: []
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      auditLog: [this.createAuditEntry(VTSAuditAction.SYMBOL_CREATED, request)]
    };

    // Add to registry
    this.registrations.set(request.symbol, registration);

    // Add alias if provided
    if (request.alias) {
      this.symbolAliases.set(request.alias.toLowerCase(), request.symbol);
    }

    // Initialize governance checks
    await this.governanceEngine.initializeGovernance(registration);

    logger.info(`VTS symbol registered: ${request.symbol}`, { registrationId: registration.id });
    return registration;
  }

  /**
   * Verify a VTS symbol
   */
  async verifySymbol(symbol: string, verificationData: VTSVerificationData): Promise<VTSRegistration> {
    const registration = this.registrations.get(symbol);
    if (!registration) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    // Update verification status
    registration.ownership.verified = true;
    registration.lifecycle.verificationDate = new Date();
    registration.governance.requiredVerification = verificationData.verificationLevel;
    registration.governance.riskLevel = verificationData.riskLevel;

    // Add audit entry
    registration.auditLog.push(
      this.createAuditEntry(VTSAuditAction.VERIFICATION_GRANTED, verificationData)
    );

    // Update status
    registration.status = VTSRegistrationStatus.VERIFIED;
    registration.updatedAt = new Date();

    logger.info(`VTS symbol verified: ${symbol}`, { level: verificationData.verificationLevel });
    return registration;
  }

  /**
   * Grant market eligibility
   */
  async grantMarketEligibility(symbol: string, eligibilityData: VTSEligibilityData): Promise<VTSRegistration> {
    const registration = this.registrations.get(symbol);
    if (!registration) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    if (registration.status !== VTSRegistrationStatus.VERIFIED) {
      throw new Error(`Symbol must be verified before market eligibility: ${symbol}`);
    }

    // Run governance checks
    const governanceResult = await this.governanceEngine.evaluateEligibility(registration, eligibilityData);
    if (!governanceResult.approved) {
      throw new Error(`Market eligibility denied: ${governanceResult.reason}`);
    }

    // Update eligibility
    registration.governance.tradingEligibility = true;
    registration.lifecycle.marketEligibilityDate = new Date();
    registration.governance.regionalApprovals = eligibilityData.regionalApprovals;

    // Add audit entry
    registration.auditLog.push(
      this.createAuditEntry(VTSAuditAction.TRADING_ENABLED, eligibilityData)
    );

    // Update status
    registration.status = VTSRegistrationStatus.MARKET_ELIGIBLE;
    registration.updatedAt = new Date();

    logger.info(`Market eligibility granted: ${symbol}`);
    return registration;
  }

  /**
   * Handle symbol conflicts
   */
  async resolveSymbolConflict(primarySymbol: string, conflictSymbols: string[], resolution: VTSConflictResolution): Promise<void> {
    logger.info(`Resolving symbol conflict: ${primarySymbol}`, { conflictSymbols, resolution });

    switch (resolution.action) {
      case 'MERGE':
        await this.mergeSymbols(primarySymbol, conflictSymbols);
        break;
      case 'SPLIT':
        await this.splitSymbol(primarySymbol, conflictSymbols);
        break;
      case 'RENAME':
        await this.renameSymbols(conflictSymbols, resolution.newSymbols!);
        break;
      case 'SEPARATE':
        // Keep symbols separate but add cross-references
        await this.linkRelatedSymbols(primarySymbol, conflictSymbols);
        break;
    }

    // Add audit entries for all affected symbols
    for (const symbol of [primarySymbol, ...conflictSymbols]) {
      const registration = this.registrations.get(symbol);
      if (registration) {
        registration.auditLog.push(
          this.createAuditEntry(VTSAuditAction.SYMBOL_MERGED, {
            primarySymbol,
            conflictSymbols,
            resolution
          })
        );
      }
    }
  }

  /**
   * Archive expired symbols
   */
  async archiveExpiredSymbols(): Promise<number> {
    const now = new Date();
    const expiredSymbols: string[] = [];

    for (const [symbol, registration] of this.registrations) {
      if (registration.lifecycle.expirationDate && registration.lifecycle.expirationDate < now) {
        if (registration.status !== VTSRegistrationStatus.ARCHIVED) {
          expiredSymbols.push(symbol);
        }
      }
    }

    for (const symbol of expiredSymbols) {
      await this.archiveSymbol(symbol);
    }

    logger.info(`Archived ${expiredSymbols.length} expired symbols`);
    return expiredSymbols.length;
  }

  /**
   * Get symbol by alias
   */
  getSymbolByAlias(alias: string): string | null {
    return this.symbolAliases.get(alias.toLowerCase()) || null;
  }

  /**
   * Get registration details
   */
  getRegistration(symbol: string): VTSRegistration | null {
    return this.registrations.get(symbol) || null;
  }

  /**
   * Search registrations
   */
  searchRegistrations(criteria: VTSSearchCriteria): VTSRegistration[] {
    const results: VTSRegistration[] = [];

    for (const registration of this.registrations.values()) {
      if (this.matchesCriteria(registration, criteria)) {
        results.push(registration);
      }
    }

    return results;
  }

  /**
   * Get registry statistics
   */
  getRegistryStatistics(): VTSRegistryStatistics {
    const stats: VTSRegistryStatistics = {
      totalSymbols: this.registrations.size,
      activeSymbols: 0,
      archivedSymbols: 0,
      marketEligibleSymbols: 0,
      symbolsByRegion: {},
      symbolsByCategory: {},
      symbolsByStatus: {},
      averageAge: 0,
      totalAliases: this.symbolAliases.size
    };

    let totalAge = 0;
    const now = new Date();

    for (const registration of this.registrations.values()) {
      // Status counts
      const status = registration.status;
      stats.symbolsByStatus[status] = (stats.symbolsByStatus[status] || 0) + 1;

      // Active/archived counts
      if (registration.status === VTSRegistrationStatus.ACTIVE) {
        stats.activeSymbols++;
      } else if (registration.status === VTSRegistrationStatus.ARCHIVED) {
        stats.archivedSymbols++;
      }

      // Market eligible count
      if (registration.governance.tradingEligibility) {
        stats.marketEligibleSymbols++;
      }

      // Region counts
      const region = registration.ownership.region;
      stats.symbolsByRegion[region] = (stats.symbolsByRegion[region] || 0) + 1;

      // Age calculation
      const age = now.getTime() - registration.createdAt.getTime();
      totalAge += age;
    }

    stats.averageAge = totalAge / this.registrations.size;

    return stats;
  }

  // Private helper methods

  private generateRegistrationId(): string {
    return 'vts_reg_' + createHash('sha256').update(Date.now().toString()).digest('hex').substring(0, 12);
  }

  private createAuditEntry(action: VTSAuditAction, data: any): VTSAuditEntry {
    return {
      id: this.generateAuditId(),
      timestamp: new Date(),
      action,
      actor: data.actor || 'system',
      region: data.region || RegionCode.GLOBAL,
      details: data
    };
  }

  private generateAuditId(): string {
    return 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  private initializeRegionalRegistrars(): void {
    // Initialize regional registrars for major regions
    const majorRegions = [
      RegionCode.SOUTH_AFRICA,
      RegionCode.NIGERIA,
      RegionCode.USA,
      RegionCode.UK,
      RegionCode.JAPAN,
      RegionCode.GERMANY,
      RegionCode.CHINA,
      RegionCode.INDIA,
      RegionCode.BRAZIL,
      RegionCode.AUSTRALIA
    ];

    for (const region of majorRegions) {
      this.regionalRegistrars.set(region, new VTSRegionalRegistrar(region));
    }

    logger.info(`Initialized ${this.regionalRegistrars.size} regional registrars`);
  }

  private async mergeSymbols(primarySymbol: string, conflictSymbols: string[]): Promise<void> {
    // Implementation for merging symbols
    logger.info(`Merging symbols into ${primarySymbol}`, { conflictSymbols });

    // Update primary symbol metadata
    const primaryRegistration = this.registrations.get(primarySymbol);
    if (primaryRegistration) {
      primaryRegistration.lifecycle.childSymbols.push(...conflictSymbols);
    }

    // Archive conflict symbols
    for (const symbol of conflictSymbols) {
      const registration = this.registrations.get(symbol);
      if (registration) {
        registration.lifecycle.parentSymbol = primarySymbol;
        registration.status = VTSRegistrationStatus.DEPRECATED;
      }
    }
  }

  private async splitSymbol(primarySymbol: string, conflictSymbols: string[]): Promise<void> {
    // Implementation for splitting symbols
    logger.info(`Splitting symbol ${primarySymbol}`, { conflictSymbols });
  }

  private async renameSymbols(symbols: string[], newSymbols: string[]): Promise<void> {
    // Implementation for renaming symbols
    logger.info(`Renaming symbols`, { symbols, newSymbols });
  }

  private async linkRelatedSymbols(primarySymbol: string, relatedSymbols: string[]): Promise<void> {
    // Implementation for linking related symbols
    logger.info(`Linking related symbols to ${primarySymbol}`, { relatedSymbols });
  }

  private async archiveSymbol(symbol: string): Promise<void> {
    const registration = this.registrations.get(symbol);
    if (registration) {
      registration.status = VTSRegistrationStatus.ARCHIVED;
      registration.lifecycle.archivalDate = new Date();
      registration.auditLog.push(
        this.createAuditEntry(VTSAuditAction.SYMBOL_ARCHIVED, { symbol })
      );
    }
  }

  private matchesCriteria(registration: VTSRegistration, criteria: VTSSearchCriteria): boolean {
    // Implementation for search criteria matching
    return true; // Simplified for now
  }
}

// Supporting classes and interfaces

export interface VTSRegistrationRequest {
  symbol: string;
  alias?: string;
  region: RegionCode;
  createdBy: string;
  metadata: any;
}

export interface VTSVerificationData {
  verificationLevel: VerificationLevel;
  riskLevel: RiskLevel;
  verifiedBy: string;
  verificationNotes?: string;
}

export interface VTSEligibilityData {
  requestedBy: string;
  regionalApprovals: RegionalApproval[];
  riskAssessment: any;
  complianceChecks: ComplianceCheck[];
}

export interface VTSConflictResolution {
  action: 'MERGE' | 'SPLIT' | 'RENAME' | 'SEPARATE';
  reason: string;
  newSymbols?: string[];
  metadata?: any;
}

export interface VTSSearchCriteria {
  region?: RegionCode;
  category?: CategoryCode;
  status?: VTSRegistrationStatus;
  verified?: boolean;
  marketEligible?: boolean;
  dateRange?: { start: Date; end: Date };
}

export interface VTSRegistryStatistics {
  totalSymbols: number;
  activeSymbols: number;
  archivedSymbols: number;
  marketEligibleSymbols: number;
  symbolsByRegion: Record<string, number>;
  symbolsByCategory: Record<string, number>;
  symbolsByStatus: Record<string, number>;
  averageAge: number;
  totalAliases: number;
}

class VTSRegionalRegistrar {
  constructor(private region: RegionCode) {
    // Regional registrar implementation
  }
}

class VTSSymbolConflictResolver {
  async checkConflicts(request: VTSRegistrationRequest): Promise<{ hasConflict: boolean; conflictReason?: string }> {
    // Implementation for conflict checking
    return { hasConflict: false };
  }
}

class VTSGovernanceEngine {
  async initializeGovernance(registration: VTSRegistration): Promise<void> {
    // Implementation for governance initialization
  }

  async evaluateEligibility(registration: VTSRegistration, data: VTSEligibilityData): Promise<{ approved: boolean; reason?: string }> {
    // Implementation for eligibility evaluation
    return { approved: true };
  }
}
