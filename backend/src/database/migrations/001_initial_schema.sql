-- ViralFX Platform Initial Database Schema
-- Social Momentum Trading Platform for South African Market

-- Enable UUID extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for enums
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'MODERATOR', 'TRADER', 'PREMIUM');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');
CREATE TYPE kyc_status AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE trend_category AS ENUM ('CELEBEX', 'BRANDPULSE', 'EDUWAVE', 'POLITIX', 'ENTERTAIN360', 'TRENDBASE');
CREATE TYPE trend_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE moderation_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');
CREATE TYPE order_type AS ENUM ('MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT');
CREATE TYPE order_side AS ENUM ('BUY', 'SELL');
CREATE TYPE order_status AS ENUM ('PENDING', 'PARTIAL_FILLED', 'FILLED', 'CANCELLED', 'REJECTED');
CREATE type transaction_type AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'TRADE', 'FEE', 'REFUND');
CREATE type transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE type payment_method AS ENUM ('PAYSTACK', 'PAYFAST', 'OZOW', 'BANK_TRANSFER', 'CRYPTO');
CREATE type payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND');
CREATE type notification_type AS ENUM ('EMAIL', 'PUSH', 'SMS', 'IN_APP');
CREATE type notification_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');
CREATE type wallet_type AS ENUM ('SPOT', 'MARGIN', 'SAVINGS', 'STAKING');
CREATE type currency_type AS ENUM ('FIAT', 'CRYPTO');

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    date_of_birth DATE,
    country VARCHAR(2) DEFAULT 'ZA',
    role user_role DEFAULT 'USER',
    status user_status DEFAULT 'ACTIVE',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    kyc_status kyc_status DEFAULT 'NOT_STARTED',
    kyc_verified_at TIMESTAMP,
    is_two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    backup_codes TEXT[],
    avatar_url VARCHAR(500),
    referral_code VARCHAR(50) UNIQUE,
    referred_by UUID REFERENCES users(id),
    last_login_at TIMESTAMP,
    last_login_ip INET,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    risk_score DECIMAL(5,2) DEFAULT 0.00,
    compliance_score DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- User Profiles Table (extended user information)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    website VARCHAR(255),
    social_links JSONB DEFAULT '{}',
    trading_preferences JSONB DEFAULT '{}',
    notification_preferences JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{}',
    marketing_consent BOOLEAN DEFAULT FALSE,
    data_sharing_consent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KYC Documents Table
CREATE TABLE kyc_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- ID_CARD, PASSPORT, PROOF_OF_ADDRESS, SELFIE
    document_number VARCHAR(100),
    document_url VARCHAR(500) NOT NULL,
    extracted_data JSONB DEFAULT '{}',
    verification_status VARCHAR(20) DEFAULT 'PENDING',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trends/Viral Assets Table
CREATE TABLE trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(50) UNIQUE NOT NULL, -- VIRAL/SA_DJ_ZINHLE_001
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category trend_category NOT NULL,
    platform VARCHAR(100), -- twitter, tiktok, instagram, youtube
    source_url VARCHAR(500),
    author VARCHAR(255),
    keywords TEXT[],
    hashtags TEXT[],
    content TEXT,
    media_urls TEXT[],
    virality_score DECIMAL(5,2) DEFAULT 0.00,
    engagement_rate DECIMAL(5,2) DEFAULT 0.00,
    sentiment_score DECIMAL(5,2) DEFAULT 0.00,
    content_risk_score DECIMAL(5,2) DEFAULT 0.00,
    market_cap DECIMAL(20,8) DEFAULT 0.00000000,
    circulating_supply DECIMAL(20,8) DEFAULT 0.00000000,
    max_supply DECIMAL(20,8),
    current_price DECIMAL(20,8) DEFAULT 0.00000000,
    price_24h_change DECIMAL(10,4) DEFAULT 0.0000,
    volume_24h DECIMAL(20,8) DEFAULT 0.00000000,
    liquidity_score DECIMAL(5,2) DEFAULT 0.00,
    volatility_score DECIMAL(5,2) DEFAULT 0.00,
    trend_strength DECIMAL(5,2) DEFAULT 0.00,
    predicted_lifespan INTEGER, -- hours
    moderation_status moderation_status DEFAULT 'PENDING',
    moderation_reason TEXT,
    moderated_by UUID REFERENCES users(id),
    moderated_at TIMESTAMP,
    status trend_status DEFAULT 'PENDING',
    is_active BOOLEAN DEFAULT TRUE,
    launched_at TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trend Price History Table
CREATE TABLE trend_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trend_id UUID NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) DEFAULT 0.00000000,
    market_cap DECIMAL(20,8) DEFAULT 0.00000000,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'INTERNAL'
);

-- Market Data Table
CREATE TABLE market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trend_id UUID NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    exchange VARCHAR(100),
    symbol VARCHAR(100),
    bid_price DECIMAL(20,8),
    ask_price DECIMAL(20,8),
    bid_size DECIMAL(20,8),
    ask_size DECIMAL(20,8),
    last_price DECIMAL(20,8),
    volume_24h DECIMAL(20,8),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Orders Table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trend_id UUID NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    order_type order_type NOT NULL,
    order_side order_side NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    stop_price DECIMAL(20,8),
    filled_quantity DECIMAL(20,8) DEFAULT 0.00000000,
    remaining_quantity DECIMAL(20,8) GENERATED ALWAYS AS (quantity - filled_quantity) STORED,
    average_fill_price DECIMAL(20,8) DEFAULT 0.00000000,
    total_value DECIMAL(20,8) GENERATED ALWAYS AS (quantity * COALESCE(price, 0)) STORED,
    status order_status DEFAULT 'PENDING',
    time_in_force VARCHAR(20) DEFAULT 'GTC', -- GTC, IOC, FOK, DAY
    order_source VARCHAR(50) DEFAULT 'WEB',
    client_order_id VARCHAR(100),
    fee_rate DECIMAL(8,6) DEFAULT 0.000000,
    fee_amount DECIMAL(20,8) DEFAULT 0.00000000,
    fee_currency VARCHAR(10) DEFAULT 'ZAR',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    filled_at TIMESTAMP
);

-- Order Fills Table
CREATE TABLE order_fills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    fill_id VARCHAR(100) NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    fee_amount DECIMAL(20,8) DEFAULT 0.00000000,
    fee_currency VARCHAR(10) DEFAULT 'ZAR',
    maker_order_id UUID REFERENCES orders(id),
    taker_order_id UUID REFERENCES orders(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallets Table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    currency_type currency_type NOT NULL,
    wallet_type wallet_type DEFAULT 'SPOT',
    balance DECIMAL(20,8) DEFAULT 0.00000000,
    available_balance DECIMAL(20,8) DEFAULT 0.00000000,
    locked_balance DECIMAL(20,8) DEFAULT 0.00000000,
    cold_balance DECIMAL(20,8) DEFAULT 0.00000000,
    address VARCHAR(255),
    memo VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    daily_limit DECIMAL(20,8) DEFAULT 0.00000000,
    daily_used DECIMAL(20,8) DEFAULT 0.00000000,
    monthly_limit DECIMAL(20,8) DEFAULT 0.00000000,
    monthly_used DECIMAL(20,8) DEFAULT 0.00000000,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, currency, wallet_type)
);

-- Transactions Table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    fee DECIMAL(20,8) DEFAULT 0.00000000,
    currency VARCHAR(10) NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    description TEXT,
    reference_id UUID, -- Reference to order, payment, etc.
    reference_type VARCHAR(50), -- ORDER, PAYMENT, WITHDRAWAL, etc.
    external_id VARCHAR(255), -- External transaction ID
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Payment Transactions Table
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payment_method payment_method NOT NULL,
    status payment_status DEFAULT 'PENDING',
    gateway_transaction_id VARCHAR(255),
    gateway_response JSONB DEFAULT '{}',
    redirect_url VARCHAR(500),
    webhook_received BOOLEAN DEFAULT FALSE,
    webhook_data JSONB DEFAULT '{}',
    refund_amount DECIMAL(20,8) DEFAULT 0.00000000,
    refund_status VARCHAR(20) DEFAULT 'NONE',
    refund_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status notification_status DEFAULT 'PENDING',
    priority VARCHAR(20) DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
    channels TEXT[] DEFAULT ARRAY['IN_APP'],
    template_name VARCHAR(100),
    template_data JSONB DEFAULT '{}',
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Delivery Attempts Table
CREATE TABLE notification_delivery_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel notification_type NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_code INTEGER,
    response_message TEXT,
    attempt_count INTEGER DEFAULT 1,
    next_attempt_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backtesting Strategies Table
CREATE TABLE backtesting_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    strategy_config JSONB NOT NULL,
    indicators TEXT[],
    parameters JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backtesting Results Table
CREATE TABLE backtesting_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID NOT NULL REFERENCES backtesting_strategies(id) ON DELETE CASCADE,
    trend_id UUID REFERENCES trends(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital DECIMAL(20,8) NOT NULL,
    final_capital DECIMAL(20,8) NOT NULL,
    total_return DECIMAL(10,4),
    annualized_return DECIMAL(10,4),
    max_drawdown DECIMAL(10,4),
    sharpe_ratio DECIMAL(10,4),
    sortino_ratio DECIMAL(10,4),
    win_rate DECIMAL(5,2),
    profit_factor DECIMAL(10,4),
    total_trades INTEGER,
    winning_trades INTEGER,
    losing_trades INTEGER,
    average_win DECIMAL(20,8),
    average_loss DECIMAL(20,8),
    largest_win DECIMAL(20,8),
    largest_loss DECIMAL(20,8),
    average_trade_duration DECIMAL(10,2), -- hours
    commissions DECIMAL(20,8) DEFAULT 0.00000000,
    detailed_results JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Moderation Tasks Table
CREATE TABLE moderation_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- TREND_REVIEW, CONTENT_REVIEW, USER_REVIEW, COMPLIANCE_CHECK
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, FAILED
    data JSONB NOT NULL,
    assigned_to UUID REFERENCES users(id),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    result JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings Table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- Trends indexes
CREATE INDEX idx_trends_symbol ON trends(symbol);
CREATE INDEX idx_trends_category ON trends(category);
CREATE INDEX idx_trends_status ON trends(status);
CREATE INDEX idx_trends_moderation_status ON trends(moderation_status);
CREATE INDEX idx_trends_virality_score ON trends(virality_score DESC);
CREATE INDEX idx_trends_created_at ON trends(created_at);
CREATE INDEX idx_trends_is_active ON trends(is_active) WHERE is_active = TRUE;

-- Price history indexes
CREATE INDEX idx_trend_price_history_trend_id ON trend_price_history(trend_id);
CREATE INDEX idx_trend_price_history_timestamp ON trend_price_history(timestamp);

-- Orders indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_trend_id ON orders(trend_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_type ON orders(order_type);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_active ON orders(status) WHERE status IN ('PENDING', 'PARTIAL_FILLED');

-- Wallets indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_currency ON wallets(currency);
CREATE INDEX idx_wallets_active ON wallets(is_active) WHERE is_active = TRUE;

-- Transactions indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Payment transactions indexes
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_method ON payment_transactions(payment_method);
CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_scheduled_at ON notifications(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_trends_active_category ON trends(category, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, status) WHERE status != 'READ';

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kyc_documents_updated_at BEFORE UPDATE ON kyc_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trends_updated_at BEFORE UPDATE ON trends FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_backtesting_strategies_updated_at BEFORE UPDATE ON backtesting_strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_moderation_tasks_updated_at BEFORE UPDATE ON moderation_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for multi-tenant data isolation
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtesting_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtesting_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own data
CREATE POLICY user_profiles_policy ON user_profiles FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY kyc_documents_policy ON kyc_documents FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY orders_policy ON orders FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY wallets_policy ON wallets FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY transactions_policy ON transactions FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY payment_transactions_policy ON payment_transactions FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY notifications_policy ON notifications FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY backtesting_strategies_policy ON backtesting_strategies FOR ALL TO authenticated_user USING (user_id = current_user_id());
CREATE POLICY backtesting_results_policy ON backtesting_results FOR ALL TO authenticated_user USING (user_id = current_user_id());

-- Admin policies for full access
CREATE POLICY admin_full_access ON user_profiles FOR ALL TO admin_role USING (true);
CREATE POLICY admin_full_access ON kyc_documents FOR ALL TO admin_role USING (true);
CREATE POLICY admin_full_access ON orders FOR ALL TO admin_role USING (true);
CREATE POLICY admin_full_access ON wallets FOR ALL TO admin_role USING (true);
CREATE POLICY admin_full_access ON transactions FOR ALL TO admin_role USING (true);
CREATE POLICY admin_full_access ON payment_transactions FOR ALL TO admin_role USING (true);
CREATE POLICY admin_full_access ON notifications FOR ALL TO admin_role USING (true);
CREATE POLICY admin_full_access ON backtesting_strategies FOR ALL TO admin_role USING (true);
CREATE POLICY admin_full_access ON backtesting_results FOR ALL TO admin_role USING (true);

-- Insert initial system settings
INSERT INTO system_settings (key, value, description, category, is_public) VALUES
('platform_name', '"ViralFX"', 'Platform name', 'general', true),
('platform_version', '"1.0.0"', 'Current platform version', 'general', true),
('maintenance_mode', 'false', 'Whether the platform is in maintenance mode', 'general', true),
('registration_enabled', 'true', 'Whether new user registration is enabled', 'general', true),
('kyc_required', 'true', 'Whether KYC verification is required for trading', 'compliance', true),
('trading_enabled', 'true', 'Whether trading is enabled', 'trading', true),
('minimum_deposit', '100.00', 'Minimum deposit amount in ZAR', 'payments', true),
('withdrawal_limits', '{"daily": 50000, "monthly": 500000}', 'Withdrawal limits in ZAR', 'payments', false),
('fee_structure', '{"trading": 0.002, "deposit": 0, "withdrawal": 0.015}', 'Fee structure', 'payments', false),
('supported_countries', '["ZA"]', 'Supported countries', 'general', true),
('risk_settings', '{"max_position_size": 0.1, "max_daily_loss": 0.05}', 'Risk management settings', 'risk', false);

-- Create functions for business logic

-- Function to calculate user's total portfolio value
CREATE OR REPLACE FUNCTION calculate_portfolio_value(user_uuid UUID)
RETURNS DECIMAL(20,8) AS $$
DECLARE
    total_value DECIMAL(20,8) := 0.00000000;
    wallet_record RECORD;
BEGIN
    FOR wallet_record IN
        SELECT currency, balance FROM wallets
        WHERE user_id = user_uuid AND is_active = true
    LOOP
        -- Convert all currencies to ZAR base currency
        IF wallet_record.currency = 'ZAR' THEN
            total_value := total_value + wallet_record.balance;
        ELSIF wallet_record.currency = 'USD' THEN
            total_value := total_value + (wallet_record.balance * 18.5); -- Approximate USD to ZAR
        ELSIF wallet_record.currency = 'EUR' THEN
            total_value := total_value + (wallet_record.balance * 20.2); -- Approximate EUR to ZAR
        ELSIF wallet_record.currency = 'BTC' THEN
            total_value := total_value + (wallet_record.balance * 450000); -- Approximate BTC to ZAR
        ELSIF wallet_record.currency = 'ETH' THEN
            total_value := total_value + (wallet_record.balance * 25000); -- Approximate ETH to ZAR
        END IF;
    END LOOP;

    RETURN total_value;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has sufficient balance
CREATE OR REPLACE FUNCTION check_sufficient_balance(user_uuid UUID, currency VARCHAR, amount DECIMAL(20,8))
RETURNS BOOLEAN AS $$
DECLARE
    available_balance DECIMAL(20,8);
BEGIN
    SELECT available_balance INTO available_balance
    FROM wallets
    WHERE user_id = user_uuid AND currency = currency AND is_active = true;

    RETURN COALESCE(available_balance, 0) >= amount;
END;
$$ LANGUAGE plpgsql;

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance(user_uuid UUID, currency VARCHAR, amount_change DECIMAL(20,8), operation VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    wallet_record RECORD;
    new_balance DECIMAL(20,8);
    new_available DECIMAL(20,8);
BEGIN
    -- Lock the wallet row for update
    SELECT * INTO wallet_record
    FROM wallets
    WHERE user_id = user_uuid AND currency = currency AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Create new wallet if it doesn't exist
        INSERT INTO wallets (user_id, currency, currency_type, balance, available_balance)
        VALUES (user_uuid, currency, 'FIAT', 0, 0)
        RETURNING * INTO wallet_record;
    END IF;

    -- Update based on operation type
    IF operation = 'ADD' THEN
        new_balance := wallet_record.balance + amount_change;
        new_available := wallet_record.available_balance + amount_change;
    ELSIF operation = 'SUBTRACT' THEN
        IF wallet_record.available_balance < amount_change THEN
            RETURN FALSE; -- Insufficient balance
        END IF;
        new_balance := wallet_record.balance - amount_change;
        new_available := wallet_record.available_balance - amount_change;
    ELSIF operation = 'LOCK' THEN
        IF wallet_record.available_balance < amount_change THEN
            RETURN FALSE; -- Insufficient available balance
        END IF;
        new_balance := wallet_record.balance;
        new_available := wallet_record.available_balance - amount_change;
    ELSIF operation = 'UNLOCK' THEN
        new_balance := wallet_record.balance;
        new_available := wallet_record.available_balance + amount_change;
    ELSE
        RETURN FALSE; -- Invalid operation
    END IF;

    -- Update the wallet
    UPDATE wallets
    SET
        balance = new_balance,
        available_balance = new_available,
        locked_balance = new_balance - new_available
    WHERE id = wallet_record.id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMIT;