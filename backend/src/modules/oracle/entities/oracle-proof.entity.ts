import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne } from 'typeorm';

@Entity('oracle_proofs')
@Index(['trendId'])
@Index(['proofHash'])
@Index(['createdAt'])
export class OracleProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trend_id' })
  trendId: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  viralityScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence: number;

  @Column({ name: 'proof_hash', length: 64, unique: true })
  proofHash: string;

  @Column({ name: 'merkle_root', length: 64 })
  merkleRoot: string;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  consensusLevel: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  consensusStrength: number;

  @Column({ type: 'jsonb' })
  validatorSignatures: any[];

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ name: 'network_type', length: 50, default: 'docker-simulated' })
  networkType: string;

  @Column({ name: 'blockchain_tx', length: 64, nullable: true })
  blockchainTx?: string;

  @Column({ name: 'verified', type: 'boolean', default: false })
  verified: boolean;

  @Column({ name: 'verification_count', default: 0 })
  verificationCount: number;

  // Relations would be added here when connecting to User entity
  // @ManyToOne(() => User, { nullable: true })
  // user?: User;

  @Column({ name: 'user_id', nullable: true, length: 255 })
  userId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;
}