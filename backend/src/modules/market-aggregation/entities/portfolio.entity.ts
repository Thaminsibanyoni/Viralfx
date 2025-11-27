import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Symbol } from './symbol.entity';

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  symbol: string;

  @Column({ type: 'decimal', precision: 15, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  averagePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  currentPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  currentValue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  unrealizedPnL: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  unrealizedPnLPercent: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  realizedPnL: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  totalPnL: number;

  @Column()
  firstPurchaseAt: Date;

  @Column()
  lastTradeAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Symbol, symbol => symbol.portfolios, { eager: false })
  @JoinColumn({ name: 'symbol', referencedColumnName: 'symbol' })
  symbolEntity: Symbol;

  // Getters
  get pnl_percentage(): number {
    if (!this.totalCost || this.totalCost === 0) return 0;
    return ((this.totalPnL || 0) / this.totalCost) * 100;
  }

  get is_profitable(): boolean {
    return (this.totalPnL || 0) > 0;
  }

  // Methods
  updateFromTrade(trade: {
    quantity: number;
    price: number;
    side: 'BUY' | 'SELL';
    tradeDate: Date;
  }): void {
    const { quantity, price, side, tradeDate } = trade;

    if (side === 'BUY') {
      // Calculate new average price
      const newTotalCost = this.totalCost + (quantity * price);
      const newTotalQuantity = this.quantity + quantity;
      this.averagePrice = newTotalCost / newTotalQuantity;
      this.quantity = newTotalQuantity;
      this.totalCost = newTotalCost;

      // Update trade dates
      if (!this.firstPurchaseAt) {
        this.firstPurchaseAt = tradeDate;
      }
      this.lastTradeAt = tradeDate;
    } else if (side === 'SELL') {
      // Update realized P&L
      const saleValue = quantity * price;
      const costBasis = (quantity / this.quantity) * this.totalCost;
      const tradePnL = saleValue - costBasis;
      this.realizedPnL += tradePnL;

      // Reduce position
      this.quantity -= quantity;
      this.totalCost = (this.quantity / (this.quantity + quantity)) * this.totalCost;

      this.lastTradeAt = tradeDate;
    }

    // Update current value and P&L
    this.updateCurrentValue();
  }

  updateCurrentValue(): void {
    if (this.currentPrice && this.quantity > 0) {
      this.currentValue = this.currentPrice * this.quantity;
      this.unrealizedPnL = this.currentValue - this.totalCost;
      this.unrealizedPnLPercent = (this.unrealizedPnL / this.totalCost) * 100;
      this.totalPnL = this.realizedPnL + this.unrealizedPnL;
    }
  }
}