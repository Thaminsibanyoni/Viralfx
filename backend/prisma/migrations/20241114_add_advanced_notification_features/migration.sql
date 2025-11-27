-- Add advanced notification features for enterprise-grade resilience and optimization

-- Update existing Notification table
ALTER TABLE "Notification"
ADD COLUMN "channel" VARCHAR(50) NOT NULL DEFAULT 'in-app',
ADD COLUMN "recipient" VARCHAR(255),
ADD COLUMN "deliveryStatus" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "sentViaProvider" VARCHAR(100);

-- Create indexes for Notification table updates
CREATE INDEX "Notification_channel_idx" ON "Notification"("channel");
CREATE INDEX "Notification_scheduledFor_idx" ON "Notification"("scheduledFor");

-- Update existing NotificationDeliveryLog table
ALTER TABLE "NotificationDeliveryLog"
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "providerId" VARCHAR(100),
ADD COLUMN "latency" INTEGER,
ADD COLUMN "cost" DECIMAL(10,4),
ADD COLUMN "region" VARCHAR(10),
ADD COLUMN "scheduledTime" TIMESTAMP(3),
ADD COLUMN "actualSendTime" TIMESTAMP(3);

-- Create indexes for NotificationDeliveryLog updates
CREATE INDEX "NotificationDeliveryLog_providerId_idx" ON "NotificationDeliveryLog"("providerId");
CREATE INDEX "NotificationDeliveryLog_sentAt_idx" ON "NotificationDeliveryLog"("sentAt");

-- Create NotificationProviderHealth table
CREATE TABLE "notification_provider_health" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "deliveryRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "avgLatency" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "costEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "circuitBreakerActive" BOOLEAN NOT NULL DEFAULT false,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_provider_health_pkey" PRIMARY KEY ("id")
);

-- Create unique index on providerId
CREATE UNIQUE INDEX "notification_provider_health_providerId_key" ON "notification_provider_health"("providerId");

-- Create NotificationProviderMetric table
CREATE TABLE "notification_provider_metric" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricType" VARCHAR(50) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "region" VARCHAR(10),
    "userId" TEXT,
    "notificationId" TEXT,

    CONSTRAINT "notification_provider_metric_pkey" PRIMARY KEY ("id")
);

-- Create indexes for NotificationProviderMetric
CREATE INDEX "notification_provider_metric_providerId_timestamp_idx" ON "notification_provider_metric"("providerId", "timestamp");
CREATE INDEX "notification_provider_metric_metricType_timestamp_idx" ON "notification_provider_metric"("metricType", "timestamp");

-- Create UserEngagementProfile table
CREATE TABLE "user_engagement_profile" (
    "userId" TEXT NOT NULL,
    "preferredHours" JSONB NOT NULL,
    "preferredDays" JSONB NOT NULL,
    "quietHours" JSONB,
    "avgEngagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "bestPerformingHour" INTEGER NOT NULL,
    "bestPerformingDay" INTEGER NOT NULL,
    "totalNotifications" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "maxNotificationsPerHour" INTEGER NOT NULL DEFAULT 5,
    "maxNotificationsPerDay" INTEGER NOT NULL DEFAULT 20,
    "hourlyNotifications" JSONB,
    "dailyNotifications" JSONB,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_engagement_profile_pkey" PRIMARY KEY ("userId")
);

-- Create index for UserEngagementProfile
CREATE INDEX "user_engagement_profile_userId_idx" ON "user_engagement_profile"("userId");

-- Create ChaosExperiment table
CREATE TABLE "chaos_experiment" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "failureType" VARCHAR(50) NOT NULL,
    "targetProvider" VARCHAR(100),
    "targetChannel" VARCHAR(50),
    "targetRegion" VARCHAR(10),
    "failureRate" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "parameters" JSONB NOT NULL,
    "safetyChecks" JSONB[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "metrics" JSONB,
    "results" JSONB,

    CONSTRAINT "chaos_experiment_pkey" PRIMARY KEY ("id")
);

-- Create indexes for ChaosExperiment
CREATE INDEX "chaos_experiment_status_idx" ON "chaos_experiment"("status");
CREATE INDEX "chaos_experiment_createdBy_idx" ON "chaos_experiment"("createdBy");
CREATE INDEX "chaos_experiment_failureType_idx" ON "chaos_experiment"("failureType");

-- Add timezone column to User table for send time optimization
ALTER TABLE "User" ADD COLUMN "timezone" VARCHAR(50) DEFAULT 'UTC';

-- Create default user engagement profiles for existing users with some activity
-- This is a data migration that would be customized based on actual user activity
INSERT INTO "user_engagement_profile" (
    "userId",
    "preferredHours",
    "preferredDays",
    "bestPerformingHour",
    "bestPerformingDay"
)
SELECT
    "id",
    '[9, 10, 14, 19, 20]::jsonb',
    '[1, 2, 3, 4, 5]::jsonb',
    19,
    3
FROM "User"
WHERE "id" NOT IN (SELECT "userId" FROM "user_engagement_profile")
LIMIT 100;

-- Initialize provider health records for known providers
INSERT INTO "notification_provider_health" ("id", "providerId") VALUES
    (gen_random_uuid()::text, 'smtp'),
    (gen_random_uuid()::text, 'sendgrid'),
    (gen_random_uuid()::text, 'mailgun'),
    (gen_random_uuid()::text, 'ses'),
    (gen_random_uuid()::text, 'twilio'),
    (gen_random_uuid()::text, 'africastalking'),
    (gen_random_uuid()::text, 'termii'),
    (gen_random_uuid()::text, 'clickatell'),
    (gen_random_uuid()::text, 'fcm'),
    (gen_random_uuid()::text, 'apns'),
    (gen_random_uuid()::text, 'onesignal')
ON CONFLICT ("providerId") DO NOTHING;

-- Update existing notifications to have proper channel and status
UPDATE "Notification"
SET
    "channel" = CASE
        WHEN "metadata"->>'deliveryMethod' = 'email' THEN 'email'
        WHEN "metadata"->>'deliveryMethod' = 'sms' THEN 'sms'
        WHEN "metadata"->>'deliveryMethod' = 'push' THEN 'push'
        ELSE 'in-app'
    END,
    "deliveryStatus" = CASE
        WHEN "deliveryStatus" = 'EMAIL_SENT' OR "deliveryStatus" = 'PUSH_SENT' OR "deliveryStatus" = 'SMS_SENT' OR "deliveryStatus" = 'IN_APP_SENT' THEN 'SENT'
        WHEN "deliveryStatus" = 'EMAIL_FAILED' OR "deliveryStatus" = 'PUSH_FAILED' OR "deliveryStatus" = 'SMS_FAILED' OR "deliveryStatus" = 'IN_APP_FAILED' THEN 'FAILED'
        ELSE 'PENDING'
    END
WHERE "channel" = 'in-app'; -- Only update the default values

-- Update existing delivery logs to extract provider information
UPDATE "NotificationDeliveryLog"
SET
    "providerId" = CASE
        WHEN "metadata"->>'provider' IS NOT NULL THEN "metadata"->>'provider'
        WHEN "channel" = 'email' AND "metadata"->>'service' = 'sendgrid' THEN 'sendgrid'
        WHEN "channel" = 'email' AND "metadata"->>'service' = 'mailgun' THEN 'mailgun'
        WHEN "channel" = 'email' AND "metadata"->>'service' = 'ses' THEN 'ses'
        WHEN "channel" = 'sms' AND "metadata"->>'service' = 'twilio' THEN 'twilio'
        WHEN "channel" = 'sms' AND "metadata"->>'service' = 'africastalking' THEN 'africastalking'
        WHEN "channel" = 'push' AND "metadata"->>'service' = 'fcm' THEN 'fcm'
        WHEN "channel" = 'push' AND "metadata"->>'service' = 'apns' THEN 'apns'
        ELSE NULL
    END,
    "cost" = CASE
        WHEN "metadata"->>'cost' IS NOT NULL THEN CAST("metadata"->>'cost' AS DECIMAL(10,4))
        ELSE NULL
    END
WHERE "providerId" IS NULL;

-- Add comments for documentation
COMMENT ON TABLE "notification_provider_health" IS 'Tracks health metrics for notification providers including delivery rates, latency, and circuit breaker status';
COMMENT ON TABLE "notification_provider_metric" IS 'Time-series metrics for provider performance tracking';
COMMENT ON TABLE "user_engagement_profile" IS 'User-specific engagement patterns for send time optimization';
COMMENT ON TABLE "chaos_experiment" IS 'Chaos engineering experiments for testing system resilience';

-- Create a view for provider health dashboard
CREATE OR REPLACE VIEW "provider_health_dashboard" AS
SELECT
    h."providerId",
    h."score",
    h."deliveryRate",
    h."avgLatency",
    h."costEfficiency",
    h."errorRate",
    h."circuitBreakerActive",
    h."consecutiveFailures",
    h."lastUpdated",
    -- Recent metrics (last hour)
    (SELECT COUNT(*) FROM "notification_provider_metric" m
     WHERE m."providerId" = h."providerId"
     AND m."metricType" = 'delivery'
     AND m."timestamp" > NOW() - INTERVAL '1 hour') as recent_deliveries,
    (SELECT AVG(m."value") FROM "notification_provider_metric" m
     WHERE m."providerId" = h."providerId"
     AND m."metricType" = 'latency'
     AND m."timestamp" > NOW() - INTERVAL '1 hour') as recent_avg_latency
FROM "notification_provider_health" h;

-- Create a function to update engagement profiles
CREATE OR REPLACE FUNCTION update_engagement_metrics(
    p_user_id TEXT,
    p_engagement_type TEXT, -- 'sent', 'delivered', 'opened', 'clicked'
    p_notification_id TEXT,
    p_response_time INTEGER DEFAULT NULL -- minutes
)
RETURNS VOID AS $$
BEGIN
    -- Update user engagement profile
    INSERT INTO "user_engagement_profile" ("userId", "preferredHours", "preferredDays", "bestPerformingHour", "bestPerformingDay")
    VALUES (p_user_id, '[9, 10, 14, 19, 20]'::jsonb, '[1, 2, 3, 4, 5]'::jsonb, 19, 3)
    ON CONFLICT ("userId") DO NOTHING;

    -- Update total notifications count
    UPDATE "user_engagement_profile"
    SET
        "totalNotifications" = "totalNotifications" + 1,
        "lastUpdated" = CURRENT_TIMESTAMP
    WHERE "userId" = p_user_id;

    -- Record engagement metric (could be expanded to track detailed engagement)
    IF p_engagement_type IN ('opened', 'clicked') AND p_response_time IS NOT NULL THEN
        UPDATE "user_engagement_profile"
        SET
            "avgResponseTime" = ("avgResponseTime" * ("totalNotifications" - 1) + p_response_time) / "totalNotifications",
            "avgEngagementRate" = LEAST(1.0, "avgEngagementRate" + 0.01),
            "lastUpdated" = CURRENT_TIMESTAMP
        WHERE "userId" = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update notification delivery logs with timestamps
CREATE OR REPLACE FUNCTION update_delivery_log_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Set sentAt if not provided and status is SUCCESS
    IF NEW."status" = 'SUCCESS' AND NEW."sentAt" IS NULL THEN
        NEW."sentAt" = CURRENT_TIMESTAMP;
    END IF;

    -- Set deliveredAt if not provided and status is SUCCESS
    IF NEW."status" = 'SUCCESS' AND NEW."deliveredAt" IS NULL THEN
        NEW."deliveredAt" = CURRENT_TIMESTAMP;
    END IF;

    -- Set actualSendTime if not provided and sentAt is set
    IF NEW."actualSendTime" IS NULL AND NEW."sentAt" IS NOT NULL THEN
        NEW."actualSendTime" = NEW."sentAt";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delivery_log_timestamps
    BEFORE INSERT OR UPDATE ON "NotificationDeliveryLog"
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_log_timestamps();