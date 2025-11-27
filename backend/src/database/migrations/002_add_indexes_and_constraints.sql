-- Additional indexes and constraints for ViralFX Platform
-- Performance optimization and data integrity enhancements

-- Additional Performance Indexes

-- Trend-specific performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trends_composite_active
ON trends(category, status, is_active)
WHERE is_active = true AND status = 'APPROVED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trends_virality_engagement
ON trends(virality_score DESC, engagement_rate DESC)
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trends_price_volatility
ON trends(current_price, volatility_score DESC)
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trends_platform_category
ON trends(platform, category)
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trends_expires_at
ON trends(expires_at)
WHERE expires_at IS NOT NULL;

-- Price history optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trend_price_history_composite
ON trend_price_history(trend_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trend_price_history_price_range
ON trend_price_history(trend_id, price, timestamp);

-- Order matching optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_matching
ON orders(trend_id, status, order_side, price)
WHERE status IN ('PENDING', 'PARTIAL_FILLED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_price_time
ON orders(trend_id, price DESC, created_at ASC)
WHERE status IN ('PENDING', 'PARTIAL_FILLED') AND order_type = 'LIMIT';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_active
ON orders(user_id, status, created_at DESC)
WHERE status IN ('PENDING', 'PARTIAL_FILLED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_fills_lookup
ON order_fills(order_id, created_at DESC);

-- Transaction and wallet optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_type_date
ON transactions(user_id, type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_reference
ON transactions(reference_type, reference_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_currency_active
ON wallets(user_id, currency, is_active)
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_balance_positive
ON wallets(user_id, balance)
WHERE balance > 0;

-- Notification optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_status_priority
ON notifications(user_id, status, priority DESC, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_pending_delivery
ON notifications(status, scheduled_at)
WHERE status = 'PENDING';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_delivery_status
ON notification_delivery_attempts(notification_id, status);

-- KYC and compliance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_documents_user_status
ON kyc_documents(user_id, verification_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_compliance_risk
ON users(kyc_status, risk_score, created_at)
WHERE kyc_status != 'VERIFIED';

-- Backtesting optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backtesting_strategies_user_public
ON backtesting_strategies(user_id, is_public, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backtesting_results_strategy
ON backtesting_results(strategy_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backtesting_results_performance
ON backtesting_results(sharpe_ratio DESC, total_return DESC);

-- Moderation optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_tasks_priority_status
ON moderation_tasks(priority DESC, status, created_at ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_tasks_assigned
ON moderation_tasks(assigned_to, status, created_at DESC);

-- Audit logs optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_composite
ON audit_logs(user_id, action, resource_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_time
ON audit_logs(resource_type, resource_id, created_at DESC);

-- Payment optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_user_status
ON payment_transactions(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_gateway
ON payment_transactions(payment_method, gateway_transaction_id)
WHERE gateway_transaction_id IS NOT NULL;

-- Data Integrity Constraints

-- Business logic constraints
ALTER TABLE orders ADD CONSTRAINT check_orders_quantity
CHECK (quantity > 0);

ALTER TABLE orders ADD CONSTRAINT check_orders_price
CHECK (price > 0 OR order_type = 'MARKET');

ALTER TABLE orders ADD CONSTRAINT check_orders_fill_consistency
CHECK (filled_quantity >= 0 AND filled_quantity <= quantity);

ALTER TABLE wallets ADD CONSTRAINT check_wallet_balances
CHECK (balance >= 0 AND available_balance >= 0 AND locked_balance >= 0);

ALTER TABLE wallets ADD CONSTRAINT check_wallet_balance_consistency
CHECK (balance = available_balance + locked_balance);

ALTER TABLE transactions ADD CONSTRAINT check_transaction_amount
CHECK (amount != 0);

ALTER TABLE trends ADD CONSTRAINT check_trend_scores
CHECK (
    virality_score >= 0 AND virality_score <= 100 AND
    engagement_rate >= 0 AND engagement_rate <= 100 AND
    sentiment_score >= -1 AND sentiment_score <= 1 AND
    content_risk_score >= 0 AND content_risk_score <= 100
);

ALTER TABLE trends ADD CONSTRAINT check_trend_prices
CHECK (
    current_price >= 0 AND
    market_cap >= 0 AND
    volume_24h >= 0
);

ALTER TABLE payment_transactions ADD CONSTRAINT check_payment_amount
CHECK (amount > 0);

ALTER TABLE payment_transactions ADD CONSTRAINT check_refund_consistency
CHECK (
    refund_amount >= 0 AND
    refund_amount <= amount
);

-- Unique constraints for business logic
ALTER TABLE orders ADD CONSTRAINT unique_client_order_id
UNIQUE (user_id, client_order_id)
WHERE client_order_id IS NOT NULL;

ALTER TABLE payment_transactions ADD CONSTRAINT unique_gateway_transaction
UNIQUE (payment_method, gateway_transaction_id)
WHERE gateway_transaction_id IS NOT NULL;

-- Complex check constraints
ALTER TABLE users ADD CONSTRAINT check_user_risk_score
CHECK (risk_score >= 0 AND risk_score <= 100);

ALTER TABLE users ADD CONSTRAINT check_user_compliance_score
CHECK (compliance_score >= 0 AND compliance_score <= 100);

ALTER TABLE backtesting_results ADD CONSTRAINT check_backtesting_capital
CHECK (final_capital >= 0 AND initial_capital > 0);

ALTER TABLE backtesting_results ADD CONSTRAINT check_backtesting_returns
CHECK (total_return >= -1);

-- Trigger Functions for Business Logic

-- Function to validate order before insertion
CREATE OR REPLACE FUNCTION validate_order_constraints()
RETURNS TRIGGER AS $$
DECLARE
    user_wallet RECORD;
    trend_info RECORD;
    required_balance DECIMAL(20,8);
BEGIN
    -- Get trend information
    SELECT * INTO trend_info FROM trends WHERE id = NEW.trend_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trend not found';
    END IF;

    -- Check if trend is active and approved
    IF NOT trend_info.is_active OR trend_info.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Trend is not available for trading';
    END IF;

    -- Get user's ZAR wallet
    SELECT * INTO user_wallet
    FROM wallets
    WHERE user_id = NEW.user_id AND currency = 'ZAR' AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User ZAR wallet not found';
    END IF;

    -- Calculate required balance
    IF NEW.order_type = 'MARKET' THEN
        -- For market orders, use current trend price
        required_balance := NEW.quantity * trend_info.current_price;
    ELSE
        -- For limit orders, use specified price
        required_balance := NEW.quantity * NEW.price;
    END IF;

    -- Add estimated fees
    required_balance := required_balance * 1.002; -- 0.2% fee

    -- Check sufficient balance for BUY orders
    IF NEW.order_side = 'BUY' AND user_wallet.available_balance < required_balance THEN
        RAISE EXCEPTION 'Insufficient balance: required %, available %',
                        required_balance, user_wallet.available_balance;
    END IF;

    -- For SELL orders, check if user owns enough trend tokens
    IF NEW.order_side = 'SELL' THEN
        SELECT * INTO user_wallet
        FROM wallets
        WHERE user_id = NEW.user_id AND currency = NEW.symbol AND is_active = true;

        IF NOT FOUND OR user_wallet.available_balance < NEW.quantity THEN
            RAISE EXCEPTION 'Insufficient trend tokens for sell order';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update trend statistics after order fill
CREATE OR REPLACE FUNCTION update_trend_statistics()
RETURNS TRIGGER AS $$
DECLARE
    last_fill RECORD;
    trend_info RECORD;
    price_change DECIMAL(20,8);
    price_change_percent DECIMAL(10,4);
BEGIN
    -- Get the most recent fill for this trend
    SELECT * INTO last_fill
    FROM order_fills
    WHERE order_id IN (
        SELECT id FROM orders WHERE trend_id = NEW.trend_id
    )
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Get current trend info
    SELECT * INTO trend_info FROM trends WHERE id = NEW.trend_id;

    -- Calculate price change
    price_change := last_fill.price - trend_info.current_price;
    IF trend_info.current_price > 0 THEN
        price_change_percent := (price_change / trend_info.current_price) * 100;
    ELSE
        price_change_percent := 0;
    END IF;

    -- Update trend statistics
    UPDATE trends SET
        current_price = last_fill.price,
        price_24h_change = price_change_percent,
        volume_24h = (
            SELECT COALESCE(SUM(quantity * price), 0)
            FROM order_fills
            WHERE order_id IN (
                SELECT id FROM orders WHERE trend_id = NEW.trend_id
            )
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.trend_id;

    -- Create price history entry
    INSERT INTO trend_price_history (trend_id, price, volume)
    VALUES (NEW.trend_id, last_fill.price, NEW.quantity);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to maintain wallet balance consistency
CREATE OR REPLACE FUNCTION maintain_wallet_balance_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure balance consistency
    IF NEW.balance != NEW.available_balance + NEW.locked_balance THEN
        RAISE EXCEPTION 'Wallet balance inconsistency detected';
    END IF;

    -- Prevent negative balances
    IF NEW.balance < 0 OR NEW.available_balance < 0 OR NEW.locked_balance < 0 THEN
        RAISE EXCEPTION 'Negative wallet balance detected';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log significant order status changes
    IF OLD.status != NEW.status THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
        VALUES (
            NEW.user_id,
            'ORDER_STATUS_CHANGE',
            'ORDER',
            NEW.id,
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS validate_order_before_insert ON orders;
CREATE CONSTRAINT TRIGGER validate_order_before_insert
    AFTER INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION validate_order_constraints();

DROP TRIGGER IF EXISTS update_trend_after_fill ON order_fills;
CREATE TRIGGER update_trend_after_fill
    AFTER INSERT ON order_fills
    FOR EACH ROW EXECUTE FUNCTION update_trend_statistics();

DROP TRIGGER IF EXISTS wallet_balance_consistency ON wallets;
CREATE CONSTRAINT TRIGGER wallet_balance_consistency
    AFTER UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION maintain_wallet_balance_consistency();

DROP TRIGGER IF EXISTS order_status_change_log ON orders;
CREATE TRIGGER order_status_change_log
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- Create materialized views for reporting

-- Daily trading volume by category
CREATE MATERIALIZED VIEW daily_trading_volume AS
SELECT
    DATE(trh.timestamp) as date,
    t.category,
    SUM(trh.volume) as total_volume,
    COUNT(*) as transaction_count,
    AVG(trh.price) as avg_price,
    MAX(trh.price) as max_price,
    MIN(trh.price) as min_price
FROM trend_price_history trh
JOIN trends t ON trh.trend_id = t.id
WHERE trh.timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(trh.timestamp), t.category
ORDER BY date DESC, total_volume DESC;

-- Create unique index for materialized view refresh
CREATE UNIQUE INDEX idx_daily_trading_volume_unique
ON daily_trading_volume(date, category);

-- User portfolio performance
CREATE MATERIALIZED VIEW user_portfolio_summary AS
SELECT
    u.id as user_id,
    u.username,
    u.created_at as registration_date,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'FILLED' THEN o.id END) as filled_orders,
    COALESCE(SUM(CASE WHEN o.status = 'FILLED' THEN o.total_value END), 0) as total_traded_value,
    COALESCE(SUM(w.balance), 0) as total_wallet_balance,
    COALESCE(SUM(w.balance), 0) + COALESCE(SUM(CASE WHEN o.status = 'FILLED' THEN o.total_value END), 0) as total_portfolio_value,
    u.kyc_status,
    u.risk_score,
    u.compliance_score
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
LEFT JOIN wallets w ON u.id = w.user_id AND w.is_active = true
GROUP BY u.id, u.username, u.created_at, u.kyc_status, u.risk_score, u.compliance_score;

CREATE UNIQUE INDEX idx_user_portfolio_summary_unique
ON user_portfolio_summary(user_id);

-- Trend performance metrics
CREATE MATERIALIZED VIEW trend_performance_metrics AS
SELECT
    t.id as trend_id,
    t.symbol,
    t.name,
    t.category,
    t.current_price,
    t.price_24h_change,
    t.volume_24h,
    t.virality_score,
    t.engagement_rate,
    t.sentiment_score,
    t.content_risk_score,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'FILLED' THEN o.id END) as filled_orders,
    COALESCE(SUM(CASE WHEN o.status = 'FILLED' THEN o.quantity END), 0) as total_volume_traded,
    COALESCE(AVG(o.price), t.current_price) as avg_trade_price,
    COUNT(DISTINCT o.user_id) as unique_traders,
    t.created_at,
    t.launched_at,
    CURRENT_TIMESTAMP - t.launched_at as age_days
FROM trends t
LEFT JOIN orders o ON t.id = o.trend_id AND o.status = 'FILLED'
WHERE t.is_active = true
GROUP BY t.id, t.symbol, t.name, t.category, t.current_price, t.price_24h_change,
         t.volume_24h, t.virality_score, t.engagement_rate, t.sentiment_score,
         t.content_risk_score, t.created_at, t.launched_at;

CREATE UNIQUE INDEX idx_trend_performance_metrics_unique
ON trend_performance_metrics(trend_id);

-- Functions to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_daily_trading_volume()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_trading_volume;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_user_portfolio_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_portfolio_summary;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_trend_performance_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY trend_performance_metrics;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled jobs using pg_cron extension (if available)
-- These would be set up by the database administrator
-- SELECT cron.schedule('refresh-daily-trading-volume', '0 */6 * * *', 'SELECT refresh_daily_trading_volume();');
-- SELECT cron.schedule('refresh-user-portfolio', '0 2 * * *', 'SELECT refresh_user_portfolio_summary();');
-- SELECT cron.schedule('refresh-trend-metrics', '*/15 * * * *', 'SELECT refresh_trend_performance_metrics();');

COMMIT;