#!/bin/bash

# Create missing entity files for TypeORM configuration

# Create order-fill.entity.ts
cat > src/database/entities/order-fill.entity.ts << 'INNER_EOF'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_fills')
export class OrderFill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, order => order.fills)
  @JoinColumn()
  order: Order;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  executedAt: Date;

  @Column({ default: true })
  isActive: boolean;
}
INNER_EOF

# Create transaction.entity.ts
cat > src/database/entities/transaction.entity.ts << 'INNER_EOF'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.transactions)
  @JoinColumn()
  user: User;

  @ManyToOne(() => Wallet, wallet => wallet.transactions)
  @JoinColumn()
  wallet: Wallet;

  @Column({ type: 'enum', enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'TRADE', 'FEE'] })
  type: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  currency: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: 'PENDING' })
  status: string;
}
INNER_EOF

# Create payment-transaction.entity.ts
cat > src/database/entities/payment-transaction.entity.ts << 'INNER_EOF'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  paymentMethod: string;

  @Column({ nullable: true })
  transactionId: string;

  @Column({ type: 'enum', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'], default: 'PENDING' })
  status: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
INNER_EOF

# Create notification.entity.ts
cat > src/database/entities/notification.entity.ts << 'INNER_EOF'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.notifications)
  @JoinColumn()
  user: User;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ type: 'enum', enum: ['INFO', 'SUCCESS', 'WARNING', 'ERROR'], default: 'INFO' })
  type: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'json', nullable: true })
  data: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;
}
INNER_EOF

# Create notification-delivery-attempt.entity.ts
cat > src/database/entities/notification-delivery-attempt.entity.ts << 'INNER_EOF'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Notification } from './notification.entity';

@Entity('notification_delivery_attempts')
export class NotificationDeliveryAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Notification)
  @JoinColumn()
  notification: Notification;

  @Column({ nullable: true })
  channel: string;

  @Column({ nullable: true })
  recipient: string;

  @Column({ type: 'enum', enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED'], default: 'PENDING' })
  status: string;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  attemptedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;
}
INNER_EOF

# Create moderation-task.entity.ts
cat > src/database/entities/moderation-task.entity.ts << 'INNER_EOF'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('moderation_tasks')
export class ModerationTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  assignedTo: User;

  @Column({ type: 'enum', enum: ['CONTENT_REVIEW', 'USER_REPORT', 'DISPUTE_RESOLUTION', 'COMPLIANCE_CHECK'] })
  taskType: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  details: Record<string, any>;

  @Column({ type: 'enum', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'], default: 'PENDING' })
  status: string;

  @Column({ type: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' })
  priority: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;
}
INNER_EOF

# Create audit-log.entity.ts
cat > src/database/entities/audit-log.entity.ts << 'INNER_EOF'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  user: User;

  @Column()
  action: string;

  @Column({ nullable: true })
  resource: string;

  @Column({ type: 'json', nullable: true })
  details: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ default: 'INFO' })
  level: string;
}
INNER_EOF

# Create system-setting.entity.ts
cat > src/database/entities/system-setting.entity.ts << 'INNER_EOF'
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'json', nullable: true })
  value: Record<string, any>;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ['STRING', 'NUMBER', 'BOOLEAN', 'JSON'], default: 'STRING' })
  valueType: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
INNER_EOF

echo "Created all missing entity files successfully!"
