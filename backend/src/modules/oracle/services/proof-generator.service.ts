import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConsensusResult } from '../interfaces/consensus-result.interface';
import { OracleProof } from '../interfaces/oracle-proof.interface';

@Injectable()
export class ProofGeneratorService {
  private readonly logger = new Logger(ProofGeneratorService.name);

  async generateProof(consensusResult: ConsensusResult): Promise<OracleProof> {
    this.logger.log(`Generating proof for trend: ${consensusResult.trendId}`);

    // 1. Create data payload for hashing
    const payload = {
      trendId: consensusResult.trendId,
      score: consensusResult.score,
      confidence: consensusResult.confidence,
      timestamp: consensusResult.timestamp,
      validators: consensusResult.validatorResponses.map(r => r.validatorId),
      consensusStrength: consensusResult.consensusStrength,
    };

    // 2. Generate SHA-256 hash of payload
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    // 3. Create Merkle tree from validator responses
    const merkleRoot = this.createMerkleRoot(consensusResult.validatorResponses);

    // 4. Collect validator signatures
    const signatures = await this.collectValidatorSignatures(consensusResult);

    // 5. Create source hash for additional verification
    const sourceHash = this.createSourceHash(consensusResult.validatorResponses);

    this.logger.log(`Proof generated successfully. Hash: ${hash.substring(0, 16)}...`);

    return {
      hash,
      merkleRoot,
      signatures,
      payload: {
        ...payload,
        sourceHash,
        dataType: 'virality',
      },
    };
  }

  async verifyProof(proof: OracleProof, originalData: any): Promise<boolean> {
    try {
      // 1. Recreate hash from payload
      const expectedHash = crypto.createHash('sha256')
        .update(JSON.stringify(proof.payload))
        .digest('hex');

      if (expectedHash !== proof.hash) {
        this.logger.warn('Proof hash verification failed');
        return false;
      }

      // 2. Verify Merkle root
      const merkleRoot = this.createMerkleRoot(originalData.validatorResponses);
      if (merkleRoot !== proof.merkleRoot) {
        this.logger.warn('Merkle root verification failed');
        return false;
      }

      // 3. Verify signatures
      for (const signature of proof.signatures) {
        const isValid = await this.verifyValidatorSignature(signature, originalData);
        if (!isValid) {
          this.logger.warn(`Invalid signature from validator: ${signature.validatorId}`);
          return false;
        }
      }

      this.logger.log('Proof verification successful');
      return true;
    } catch (error) {
      this.logger.error('Proof verification error:', error);
      return false;
    }
  }

  private createMerkleRoot(responses: any[]): string {
    if (responses.length === 0) {
      return crypto.createHash('sha256').update('empty').digest('hex');
    }

    // Create leaf nodes from response data
    let level = responses.map(response => {
      const data = JSON.stringify({
        validatorId: response.validatorId,
        score: response.data.viralityScore,
        confidence: response.data.confidence,
        timestamp: response.data.timestamp,
      });
      return crypto.createHash('sha256').update(data).digest('hex');
    });

    // Build Merkle tree
    while (level.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || level[i]; // For odd numbers, duplicate last element
        const combined = left + right;
        nextLevel.push(crypto.createHash('sha256').update(combined).digest('hex'));
      }
      level = nextLevel;
    }

    return level[0];
  }

  private async collectValidatorSignatures(consensusResult: ConsensusResult): Promise<any[]> {
    const signatures = [];

    for (const response of consensusResult.validatorResponses) {
      // Create signature from response data
      const dataToSign = JSON.stringify(response.data);
      const signature = crypto.createHash('sha256')
        .update(dataToSign + response.validatorId) // Add validator ID as salt
        .digest('hex');

      signatures.push({
        validatorId: response.validatorId,
        signature,
        timestamp: response.data.timestamp,
        publicKey: `pk-${response.validatorId}`, // Mock public key
      });
    }

    return signatures;
  }

  private createSourceHash(responses: any[]): string {
    const sourceData = responses.map(r => ({
      validatorId: r.validatorId,
      timestamp: r.data.timestamp,
      random: Math.random().toString(36).substring(7), // Add randomness
    }));

    return crypto.createHash('sha256')
      .update(JSON.stringify(sourceData))
      .digest('hex');
  }

  private async verifyValidatorSignature(signature: any, originalData: any): Promise<boolean> {
    // Find the original response for this validator
    const originalResponse = originalData.validatorResponses.find(
      r => r.validatorId === signature.validatorId
    );

    if (!originalResponse) {
      return false;
    }

    // Recreate expected signature
    const dataToSign = JSON.stringify(originalResponse.data);
    const expectedSignature = crypto.createHash('sha256')
      .update(dataToSign + signature.validatorId)
      .digest('hex');

    return signature.signature === expectedSignature;
  }

  generateMerkleProof(leafIndex: number, responses: any[]): any {
    if (responses.length === 0) {
      return null;
    }

    // Create leaf nodes
    let level = responses.map(response => {
      const data = JSON.stringify({
        validatorId: response.validatorId,
        score: response.data.viralityScore,
        confidence: response.data.confidence,
        timestamp: response.data.timestamp,
      });
      return {
        hash: crypto.createHash('sha256').update(data).digest('hex'),
        isLeaf: true,
        index: responses.indexOf(response),
      };
    });

    const proof = [];
    let currentIndex = leafIndex;

    // Build proof by collecting sibling hashes at each level
    while (level.length > 1) {
      const nextLevel = [];

      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || level[i];
        const combined = left.hash + right.hash;
        const parentHash = crypto.createHash('sha256').update(combined).digest('hex');

        // If current node is part of the proof path, add its sibling
        if (i === currentIndex || (i + 1 === currentIndex)) {
          const sibling = i === currentIndex ? right : left;
          proof.push({
            hash: sibling.hash,
            isLeft: i === currentIndex,
          });
          currentIndex = Math.floor(i / 2);
        }

        nextLevel.push({
          hash: parentHash,
          isLeaf: false,
        });
      }

      level = nextLevel;
    }

    return {
      root: level[0].hash,
      proof,
      leafIndex,
    };
  }
}