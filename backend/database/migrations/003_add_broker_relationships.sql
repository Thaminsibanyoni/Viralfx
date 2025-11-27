-- Migration: Add broker relationships and commission tracking
-- Version: 003
-- Description: Adds broker_id columns to users and orders tables, creates broker enums, and adds commission tracking

-- Add broker_id column to users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'broker_id'
    ) THEN
        ALTER TABLE users ADD COLUMN broker_id UUID NULL;

        -- Create index for broker_id in users table
        CREATE INDEX idx_users_broker ON users(broker_id);

        -- Add foreign key constraint if brokers table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brokers') THEN
            ALTER TABLE users ADD CONSTRAINT fk_users_broker
                FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE SET NULL;
        END IF;

        RAISE NOTICE 'Added broker_id column to users table';
    END IF;
END $$;

-- Add broker attribution columns to orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'broker_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN broker_id UUID NULL;
        ALTER TABLE orders ADD COLUMN broker_commission DECIMAL(12,2) DEFAULT 0.00;
        ALTER TABLE orders ADD COLUMN platform_commission DECIMAL(12,2) DEFAULT 0.00;

        -- Create indexes for broker analytics
        CREATE INDEX idx_orders_broker_status_date ON orders(broker_id, status, created_at);

        -- Add foreign key constraint if brokers table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brokers') THEN
            ALTER TABLE orders ADD CONSTRAINT fk_orders_broker
                FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE SET NULL;
        END IF;

        RAISE NOTICE 'Added broker attribution columns to orders table';
    END IF;
END $$;

-- Add broker tier column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'brokers' AND column_name = 'tier'
    ) THEN
        -- Create broker_tier enum type
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'broker_tier') THEN
                CREATE TYPE broker_tier AS ENUM ('STARTER', 'VERIFIED', 'PREMIUM', 'ENTERPRISE');
            END IF;
        END $$;

        ALTER TABLE brokers ADD COLUMN tier broker_tier DEFAULT 'STARTER';

        RAISE NOTICE 'Added tier column to brokers table';
    END IF;
END $$;

-- Create broker_status enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'broker_status') THEN
        CREATE TYPE broker_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');
        RAISE NOTICE 'Created broker_status enum type';
    END IF;
END $$;

-- Create attribution_type enum type for broker clients if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attribution_type') THEN
        CREATE TYPE attribution_type AS ENUM (
            'REFERRAL_LINK',
            'REFERRAL_CODE',
            'DIRECT_SIGNUP',
            'API_INTEGRATION',
            'WHITE_LABEL',
            'OAUTH'
        );
        RAISE NOTICE 'Created attribution_type enum type';
    END IF;
END $$;

-- Create broker_clients table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'broker_clients') THEN
        CREATE TABLE broker_clients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            broker_id UUID NOT NULL,
            client_id UUID NOT NULL,
            attribution_type attribution_type NOT NULL,
            attribution_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            attribution_metadata JSONB NULL,
            status VARCHAR(20) DEFAULT 'ACTIVE',
            is_active BOOLEAN DEFAULT true,
            total_commission DECIMAL(12,2) DEFAULT 0.00,
            total_broker_commission DECIMAL(12,2) DEFAULT 0.00,
            total_platform_commission DECIMAL(12,2) DEFAULT 0.00,
            last_commission_at TIMESTAMP WITH TIME ZONE NULL,
            total_orders INTEGER DEFAULT 0,
            total_volume DECIMAL(15,2) DEFAULT 0.00,
            last_order_at TIMESTAMP WITH TIME ZONE NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT unique_broker_client UNIQUE(broker_id, client_id)
        );

        -- Create indexes
        CREATE INDEX idx_broker_clients_broker_status ON broker_clients(broker_id, status);
        CREATE INDEX idx_broker_clients_client_attribution ON broker_clients(client_id, attribution_type);

        -- Add foreign key constraints
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brokers') THEN
            ALTER TABLE broker_clients ADD CONSTRAINT fk_broker_clients_broker
                FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
            ALTER TABLE broker_clients ADD CONSTRAINT fk_broker_clients_client
                FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;

        RAISE NOTICE 'Created broker_clients table';
    END IF;
END $$;

-- Create broker_bills table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'broker_bills') THEN
        CREATE TABLE broker_bills (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            broker_id UUID NOT NULL,
            period_start TIMESTAMP WITH TIME ZONE NOT NULL,
            period_end TIMESTAMP WITH TIME ZONE NOT NULL,
            due_date TIMESTAMP WITH TIME ZONE NOT NULL,
            total_commission DECIMAL(12,2) NOT NULL,
            base_fee DECIMAL(12,2) NOT NULL,
            volume_discount DECIMAL(12,2) DEFAULT 0.00,
            performance_bonus DECIMAL(12,2) DEFAULT 0.00,
            tier_multiplier DECIMAL(5,4) DEFAULT 1.0000,
            vat_amount DECIMAL(12,2) DEFAULT 0.00,
            total_amount DECIMAL(12,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'PENDING',
            paid_at TIMESTAMP WITH TIME ZONE NULL,
            payment_method VARCHAR(50) NULL,
            transaction_id VARCHAR(100) NULL,
            client_count INTEGER NOT NULL,
            transaction_count INTEGER NOT NULL,
            volume_breakdown JSONB NULL,
            commission_breakdown JSONB NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes
        CREATE INDEX idx_broker_bills_broker_period ON broker_bills(broker_id, period_start);
        CREATE INDEX idx_broker_bills_status_due_date ON broker_bills(status, due_date);

        -- Add foreign key constraint
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brokers') THEN
            ALTER TABLE broker_bills ADD CONSTRAINT fk_broker_bills_broker
                FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE;
        END IF;

        RAISE NOTICE 'Created broker_bills table';
    END IF;
END $$;

-- Add comments to document the purpose of new columns
COMMENT ON COLUMN users.broker_id IS 'Optional reference to the broker this user is attributed to';
COMMENT ON COLUMN orders.broker_id IS 'Optional reference to the broker for commission attribution';
COMMENT ON COLUMN orders.broker_commission IS 'Commission amount allocated to the broker';
COMMENT ON COLUMN orders.platform_commission IS 'Commission amount retained by the platform';
COMMENT ON COLUMN brokers.tier IS 'Broker tier level affecting commission rates and features';

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to broker_clients and broker_bills tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'broker_clients') THEN
        CREATE TRIGGER update_broker_clients_updated_at
            BEFORE UPDATE ON broker_clients
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'broker_bills') THEN
        CREATE TRIGGER update_broker_bills_updated_at
            BEFORE UPDATE ON broker_bills
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

RAISE NOTICE 'Migration 003 completed: Added broker relationships and commission tracking';