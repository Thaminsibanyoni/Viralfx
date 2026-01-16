import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  OracleSource,
  OracleHealthStatus,
  SignalStatus,
} from '../dto/oracle-governance.dto';

@Injectable()
export class OracleGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Approve a pending signal
   */
  async approveSignal(signalId: string, notes?: string) {
    const signal = await this.findSignal(signalId);

    if (signal.status !== 'pending' && signal.status !== 'flagged') {
      throw new BadRequestException(`Cannot approve signal with status: ${signal.status}`);
    }

    const updated = await this.prisma.oracleSignal.update({
      where: { id: signalId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: 'admin',
        approvalNotes: notes,
      },
    });

    await this.auditService.log({
      action: 'SIGNAL_APPROVED',
      entityType: 'OracleSignal',
      entityId: signalId,
      details: {
        trendName: signal.trendName,
        source: signal.source,
        previousStatus: signal.status,
        notes,
      },
      severity: 'info',
    });

    return updated;
  }

  /**
   * Reject a signal
   */
  async rejectSignal(signalId: string, reason: string) {
    const signal = await this.findSignal(signalId);

    if (signal.status === 'approved') {
      throw new BadRequestException('Cannot reject already approved signal');
    }

    const updated = await this.prisma.oracleSignal.update({
      where: { id: signalId },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: 'admin',
        rejectionReason: reason,
      },
    });

    await this.auditService.log({
      action: 'SIGNAL_REJECTED',
      entityType: 'OracleSignal',
      entityId: signalId,
      details: {
        trendName: signal.trendName,
        source: signal.source,
        previousStatus: signal.status,
        reason,
      },
      severity: 'warning',
    });

    return updated;
  }

  /**
   * Update oracle source health status
   */
  async updateOracleHealth(
    source: string,
    status: string,
    confidenceScore?: number,
    deceptionRisk?: number,
    notes?: string,
  ) {
    const oracle = await this.prisma.oracleSource.findFirst({
      where: { source: source.toLowerCase() },
    });

    const data: any = {
      status: status.toLowerCase(),
      lastHealthCheck: new Date(),
    };

    if (confidenceScore !== undefined) data.confidenceScore = confidenceScore;
    if (deceptionRisk !== undefined) data.deceptionRisk = deceptionRisk;
    if (notes) data.notes = notes;

    const updated = oracle
      ? await this.prisma.oracleSource.update({
          where: { id: oracle.id },
          data,
        })
      : await this.prisma.oracleSource.create({
          data: {
            ...data,
            source: source.toLowerCase(),
            name: source.charAt(0).toUpperCase() + source.slice(1),
          },
        });

    await this.auditService.log({
      action: 'ORACLE_HEALTH_UPDATED',
      entityType: 'OracleSource',
      entityId: updated.id,
      details: {
        source: updated.source,
        previousStatus: oracle?.status || 'unknown',
        newStatus: status,
        confidenceScore,
        deceptionRisk,
        notes,
      },
      severity: status === 'offline' ? 'critical' : 'info',
    });

    return updated;
  }

  /**
   * Set oracle mode (LIVE, SIMULATED, SEED)
   */
  async setOracleMode(source: string, mode: 'LIVE' | 'SIMULATED' | 'SEED') {
    const oracle = await this.prisma.oracleSource.findFirst({
      where: { source: source.toLowerCase() },
    });

    if (!oracle) {
      throw new NotFoundException('Oracle source not found');
    }

    const updated = await this.prisma.oracleSource.update({
      where: { id: oracle.id },
      data: { mode },
    });

    await this.auditService.log({
      action: 'ORACLE_MODE_CHANGED',
      entityType: 'OracleSource',
      entityId: oracle.id,
      details: {
        source: oracle.source,
        previousMode: oracle.mode,
        newMode: mode,
      },
      severity: 'warning',
    });

    return updated;
  }

  /**
   * Update signal confidence score
   */
  async updateSignalConfidence(signalId: string, confidenceScore: number, reason?: string) {
    if (confidenceScore < 0 || confidenceScore > 100) {
      throw new BadRequestException('Confidence score must be between 0 and 100');
    }

    const signal = await this.findSignal(signalId);

    const updated = await this.prisma.oracleSignal.update({
      where: { id: signalId },
      data: {
        confidenceScore,
        adjustedAt: new Date(),
        adjustedBy: 'admin',
        adjustmentReason: reason,
      },
    });

    await this.auditService.log({
      action: 'SIGNAL_CONFIDENCE_UPDATED',
      entityType: 'OracleSignal',
      entityId: signalId,
      details: {
        trendName: signal.trendName,
        previousScore: signal.confidenceScore,
        newScore: confidenceScore,
        reason,
      },
      severity: 'info',
    });

    return updated;
  }

  /**
   * Flag a signal for review
   */
  async flagSignal(signalId: string, reason: string, requiresReview = true) {
    const signal = await this.findSignal(signalId);

    const updated = await this.prisma.oracleSignal.update({
      where: { id: signalId },
      data: {
        status: 'flagged',
        flaggedAt: new Date(),
        flaggedBy: 'admin',
        flagReason: reason,
        requiresReview,
      },
    });

    await this.auditService.log({
      action: 'SIGNAL_FLAGGED',
      entityType: 'OracleSignal',
      entityId: signalId,
      details: {
        trendName: signal.trendName,
        reason,
        requiresReview,
      },
      severity: 'warning',
    });

    return updated;
  }

  /**
   * Get pending signals
   */
  async getPendingSignals() {
    return this.prisma.oracleSignal.findMany({
      where: { status: 'pending' },
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Get flagged signals
   */
  async getFlaggedSignals() {
    return this.prisma.oracleSignal.findMany({
      where: { status: 'flagged' },
      orderBy: { flaggedAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Get all oracle sources with health status
   */
  async getOracleSources() {
    return this.prisma.oracleSource.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get signals by source
   */
  async getSignalsBySource(source: string, limit = 50) {
    return this.prisma.oracleSignal.findMany({
      where: { source: source.toLowerCase() },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get low confidence signals
   */
  async getLowConfidenceSignals(threshold = 50) {
    return this.prisma.oracleSignal.findMany({
      where: {
        confidenceScore: { lt: threshold },
        status: { not: 'rejected' },
      },
      orderBy: { confidenceScore: 'asc' },
      take: 100,
    });
  }

  /**
   * Get high deception risk signals
   */
  async getHighDeceptionRiskSignals(threshold = 70) {
    return this.prisma.oracleSignal.findMany({
      where: {
        deceptionRisk: { gte: threshold },
        status: { not: 'rejected' },
      },
      orderBy: { deceptionRisk: 'desc' },
      take: 100,
    });
  }

  /**
   * Helper: Find signal or throw 404
   */
  private async findSignal(id: string) {
    const signal = await this.prisma.oracleSignal.findUnique({
      where: { id },
    });

    if (!signal) {
      throw new NotFoundException('Signal not found');
    }

    return signal;
  }
}
