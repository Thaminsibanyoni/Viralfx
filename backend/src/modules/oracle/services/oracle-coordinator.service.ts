import { Injectable, Logger } from '@nestjs/common';
import { ConsensusService } from './consensus.service';
import { ProofGeneratorService } from './proof-generator.service';
import { OracleRequestDto } from '../dto/oracle-request.dto';
import { OracleResponseDto } from '../dto/oracle-response.dto';
import { OracleProof } from '../entities/oracle-proof.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OracleCoordinatorService {
  private readonly logger = new Logger(OracleCoordinatorService.name);

  constructor(
    private readonly consensusService: ConsensusService,
    private readonly proofGenerator: ProofGeneratorService,
    @InjectRepository(OracleProof)
    private readonly oracleProofRepository: Repository<OracleProof>,
  ) {}

  async processOracleRequest(request: OracleRequestDto): Promise<OracleResponseDto> {
    const startTime = Date.now();
    this.logger.log(`🚀 Processing oracle request for trend: ${request.trendId}`);

    try {
      // 1. Distribute request to validator network
      this.logger.log('📡 Distributing request to validator network...');
      const validatorResponses = await this.consensusService.distributeToValidators(request);

      // 2. Achieve consensus among validators
      this.logger.log('🤝 Achieving consensus...');
      const consensusResult = await this.consensusService.achieveConsensus(validatorResponses);

      // 3. Generate cryptographic proof
      this.logger.log('🔐 Generating cryptographic proof...');
      const proof = await this.proofGenerator.generateProof(consensusResult);

      // 4. Store proof in database
      this.logger.log('💾 Storing proof in database...');
      await this.storeOracleProof(consensusResult, proof);

      // 5. Construct response
      const processingTime = Date.now() - startTime;
      const response: OracleResponseDto = {
        trendId: request.trendId,
        viralityScore: consensusResult.score,
        confidence: consensusResult.confidence,
        timestamp: consensusResult.timestamp,
        proofHash: proof.hash,
        merkleRoot: proof.merkleRoot,
        validatorSignatures: proof.signatures,
        consensusLevel: consensusResult.agreement,
        networkType: 'docker-simulated',
        consensusStrength: consensusResult.consensusStrength,
      };

      this.logger.log(`✅ Oracle request completed in ${processingTime}ms. Score: ${consensusResult.score.toFixed(4)}`);
      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`❌ Oracle request failed after ${processingTime}ms:`, error.message);
      throw error;
    }
  }

  async getLatestOracleData(trendId: string): Promise<OracleResponseDto | null> {
    this.logger.log(`🔍 Retrieving latest oracle data for trend: ${trendId}`);

    const latestProof = await this.oracleProofRepository.findOne({
      where: { trendId },
      order: { createdAt: 'DESC' },
    });

    if (!latestProof) {
      this.logger.warn(`No oracle data found for trend: ${trendId}`);
      return null;
    }

    const response: OracleResponseDto = {
      trendId: latestProof.trendId,
      viralityScore: latestProof.viralityScore,
      confidence: latestProof.confidence,
      timestamp: latestProof.createdAt.getTime(),
      proofHash: latestProof.proofHash,
      merkleRoot: latestProof.merkleRoot,
      validatorSignatures: latestProof.validatorSignatures,
      consensusLevel: latestProof.consensusLevel,
      networkType: latestProof.networkType,
      consensusStrength: latestProof.consensusStrength,
    };

    this.logger.log(`✅ Retrieved oracle data for trend: ${trendId}, score: ${latestProof.viralityScore.toFixed(4)}`);
    return response;
  }

  async verifyProof(proofHash: string): Promise<any> {
    this.logger.log(`🔍 Verifying proof: ${proofHash.substring(0, 16)}...`);

    const proof = await this.oracleProofRepository.findOne({
      where: { proofHash },
    });

    if (!proof) {
      this.logger.warn(`Proof not found: ${proofHash}`);
      return { verified: false, error: 'Proof not found' };
    }

    try {
      // Verify the proof using the proof generator
      const isValid = await this.proofGenerator.verifyProof(
        {
          hash: proof.proofHash,
          merkleRoot: proof.merkleRoot,
          signatures: proof.validatorSignatures,
          payload: proof.payload,
        },
        {
          validatorResponses: proof.validatorSignatures.map(sig => ({
            validatorId: sig.validatorId,
            data: {
              viralityScore: proof.viralityScore,
              confidence: proof.confidence,
              timestamp: sig.timestamp,
            },
          })),
        }
      );

      if (isValid) {
        // Increment verification count
        await this.oracleProofRepository.increment(
          { id: proof.id },
          'verificationCount',
          1
        );

        this.logger.log(`✅ Proof verified successfully: ${proofHash.substring(0, 16)}...`);
        return {
          verified: true,
          trendId: proof.trendId,
          viralityScore: proof.viralityScore,
          confidence: proof.confidence,
          consensusLevel: proof.consensusLevel,
          verificationCount: proof.verificationCount + 1,
          verifiedAt: Date.now(),
        };
      } else {
        this.logger.warn(`❌ Proof verification failed: ${proofHash.substring(0, 16)}...`);
        return { verified: false, error: 'Proof verification failed' };
      }
    } catch (error) {
      this.logger.error(`❌ Proof verification error:`, error.message);
      return { verified: false, error: error.message };
    }
  }

  async getOracleStatus(): Promise<any> {
    this.logger.log('📊 Getting oracle status...');

    const [
      totalProofs,
      recentProofs,
      validatorHealth,
    ] = await Promise.all([
      this.oracleProofRepository.count(),
      this.oracleProofRepository.count({
        where: {
          createdAt: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
      this.consensusService.getValidatorHealth(),
    ]);

    const avgConsensusStrength = await this.oracleProofRepository
      .createQueryBuilder('proof')
      .select('AVG(proof.consensusStrength)', 'avg')
      .getRawOne()
      .then(result => parseFloat(result?.avg || '0'));

    return {
      status: 'active',
      networkType: 'docker-simulated',
      totalProofs,
      recentProofs24h: recentProofs,
      validators: validatorHealth,
      averageConsensusStrength: avgConsensusStrength,
      uptime: process.uptime(),
      lastUpdate: Date.now(),
      features: {
        proofGeneration: true,
        consensusAchievement: true,
        merkleTrees: true,
        signatureVerification: true,
        blockchainReady: false, // Will be true in Phase 2
      },
    };
  }

  async getOracleHistory(trendId: string, limit: number = 10): Promise<any[]> {
    this.logger.log(`📈 Getting oracle history for trend: ${trendId}, limit: ${limit}`);

    const proofs = await this.oracleProofRepository.find({
      where: { trendId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return proofs.map(proof => ({
      timestamp: proof.createdAt.getTime(),
      viralityScore: proof.viralityScore,
      confidence: proof.confidence,
      consensusLevel: proof.consensusLevel,
      consensusStrength: proof.consensusStrength,
      proofHash: proof.proofHash,
      verified: proof.verified,
      verificationCount: proof.verificationCount,
    }));
  }

  private async storeOracleProof(consensusResult: any, proof: OracleProof): Promise<void> {
    const oracleProof = this.oracleProofRepository.create({
      trendId: consensusResult.trendId,
      viralityScore: consensusResult.score,
      confidence: consensusResult.confidence,
      proofHash: proof.hash,
      merkleRoot: proof.merkleRoot,
      consensusLevel: consensusResult.agreement,
      consensusStrength: consensusResult.consensusStrength,
      validatorSignatures: proof.signatures,
      payload: proof.payload,
      networkType: 'docker-simulated',
      verified: false,
      verificationCount: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiry
    });

    await this.oracleProofRepository.save(oracleProof);
    this.logger.log(`💾 Oracle proof stored successfully: ${proof.hash.substring(0, 16)}...`);
  }
}