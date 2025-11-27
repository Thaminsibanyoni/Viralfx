import { Entity, Column, Index, BeforeInsert, BeforeUpdate } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum StrategyCategory {
  TREND_MOMENTUM = 'TREND_MOMENTUM',
  SENTIMENT_REVERSAL = 'SENTIMENT_REVERSAL',
  VOLATILITY_BREAKOUT = 'VOLATILITY_BREAKOUT',
  CUSTOM = 'CUSTOM',
}

export interface StrategyParameter {
  name: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface StrategyRule {
  type: 'BUY' | 'SELL' | 'EXIT';
  condition: 'AND' | 'OR';
  criteria: StrategyCriterion[];
}

export interface StrategyCriterion {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains';
  value: any;
}

@Entity('backtesting_strategies')
@Index(['name'])
@Index(['category'])
@Index(['userId'])
@Index(['isActive'])
export class BacktestingStrategy extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: StrategyCategory,
    default: StrategyCategory.CUSTOM,
  })
  category: StrategyCategory;

  @Column({
    type: 'jsonb',
    array: false,
    default: () => "'[]'::jsonb",
  })
  parameters: StrategyParameter[];

  @Column({
    type: 'jsonb',
    array: false,
    default: () => "'[]'::jsonb",
  })
  rules: StrategyRule[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 20, default: '1.0.0' })
  version: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @BeforeInsert()
  @BeforeUpdate()
  validateParameters() {
    if (this.parameters && !Array.isArray(this.parameters)) {
      throw new Error('Parameters must be an array');
    }

    if (this.rules && !Array.isArray(this.rules)) {
      throw new Error('Rules must be an array');
    }

    // Validate parameter structure
    if (this.parameters) {
      for (const param of this.parameters) {
        if (!param.name || !param.type || param.defaultValue === undefined) {
          throw new Error('Each parameter must have name, type, and defaultValue');
        }
      }
    }

    // Validate rule structure
    if (this.rules) {
      for (const rule of this.rules) {
        if (!rule.type || !rule.condition || !Array.isArray(rule.criteria)) {
          throw new Error('Each rule must have type, condition, and criteria array');
        }
      }
    }
  }
}