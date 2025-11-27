-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'MODERATOR', 'ANALYST', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE', 'SALES', 'COMPLIANCE', 'LEGAL', 'KYC_REVIEWER', 'BROKER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BrokerStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BrokerTier" AS ENUM ('STARTER', 'VERIFIED', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BrokerType" AS ENUM ('FINANCIAL_INSTITUTION', 'INDEPENDENT_BROKER', 'TRADING_FIRM', 'CRYPTOCURRENCY_EXCHANGE');

-- CreateEnum
CREATE TYPE "AttributionType" AS ENUM ('REFERRAL_LINK', 'REFERRAL_CODE', 'DIRECT_SIGNUP', 'API_INTEGRATION', 'WHITE_LABEL', 'OAUTH');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TWITTER', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'REDDIT', 'DISCORD', 'TELEGRAM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'MIXED');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('BINARY', 'RANGE', 'THRESHOLD', 'BASKET');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('PENDING', 'OPEN', 'CLOSED', 'SETTLING', 'SETTLED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'ACTIVE', 'WON', 'LOST', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_PAYOUT', 'BET_REFUND', 'FEE', 'BONUS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ValidatorStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OracleRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'PERMANENTLY_FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstName" TEXT,
    "lastName" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "country" TEXT,
    "balanceUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceLocked" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NONE',
    "kycDocuments" JSONB,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "deviceFingerprint" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "suspension_reason" TEXT,
    "suspended_at" TIMESTAMP(3),
    "referral_code" TEXT,
    "referred_by" TEXT,
    "preferences" JSONB,
    "broker_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broker" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "fscaLicenseNumber" TEXT,
    "fscaLicenseExpiry" TIMESTAMP(3),
    "tier" "BrokerTier" NOT NULL DEFAULT 'STARTER',
    "type" "BrokerType" NOT NULL DEFAULT 'INDEPENDENT_BROKER',
    "status" "BrokerStatus" NOT NULL DEFAULT 'PENDING',
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "physicalAddress" TEXT NOT NULL,
    "postalAddress" TEXT,
    "website" TEXT,
    "businessProfile" JSONB,
    "complianceInfo" JSONB,
    "paymentInfo" JSONB,
    "oauthConfig" JSONB,
    "apiConfig" JSONB,
    "riskAssessment" JSONB,
    "isPubliclyListed" BOOLEAN NOT NULL DEFAULT false,
    "acceptNewClients" BOOLEAN NOT NULL DEFAULT true,
    "totalTraders" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "numberOfReviews" INTEGER NOT NULL DEFAULT 0,
    "trustScore" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "socialLinks" JSONB,
    "operatingHours" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerClient" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "attributionType" "AttributionType" NOT NULL,
    "attributionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attributionMetadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalBrokerCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPlatformCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastCommissionAt" TIMESTAMP(3),
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerBill" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "totalCommission" DECIMAL(12,2) NOT NULL,
    "baseFee" DECIMAL(12,2) NOT NULL,
    "volumeDiscount" DECIMAL(12,2) NOT NULL,
    "performanceBonus" DECIMAL(12,2) NOT NULL,
    "tierMultiplier" DECIMAL(5,4) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "clientCount" INTEGER NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "volumeBreakdown" JSONB,
    "commissionBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "canonical" JSONB NOT NULL,
    "status" "TopicStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "totalVolume" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalBets" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestEvent" (
    "id" TEXT NOT NULL,
    "topicId" TEXT,
    "platform" "Platform" NOT NULL,
    "nativeId" TEXT,
    "authorId" TEXT,
    "authorHandle" TEXT,
    "contentType" "ContentType" NOT NULL,
    "textContent" TEXT,
    "mediaUrls" JSONB,
    "s3RawPath" TEXT,
    "engagementCount" INTEGER,
    "likesCount" INTEGER,
    "sharesCount" INTEGER,
    "commentsCount" INTEGER,
    "viewsCount" INTEGER,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingErrors" JSONB,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "IngestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentimentSnapshot" (
    "id" TEXT NOT NULL,
    "ingestEventId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "scoreFloat" DOUBLE PRECISION NOT NULL,
    "posPct" DOUBLE PRECISION NOT NULL,
    "negPct" DOUBLE PRECISION NOT NULL,
    "neutralPct" DOUBLE PRECISION NOT NULL,
    "emotions" JSONB,
    "modelVersion" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rawResponse" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentimentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeceptionSnapshot" (
    "id" TEXT NOT NULL,
    "ingestEventId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "drs" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "evidenceItems" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "hmacSignature" TEXT NOT NULL,
    "rawResponse" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeceptionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViralIndexSnapshot" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "viralIndex" DOUBLE PRECISION NOT NULL,
    "viralVelocity" DOUBLE PRECISION NOT NULL,
    "viralSentiment" DOUBLE PRECISION NOT NULL,
    "truthTension" DOUBLE PRECISION NOT NULL,
    "engagementTotal" INTEGER NOT NULL,
    "engagementRate" DOUBLE PRECISION NOT NULL,
    "sentimentMean" DOUBLE PRECISION NOT NULL,
    "sentimentStd" DOUBLE PRECISION NOT NULL,
    "deceptionMean" DOUBLE PRECISION NOT NULL,
    "deceptionStd" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "windowMinutes" INTEGER NOT NULL DEFAULT 60,
    "rawMetrics" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViralIndexSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "marketType" "MarketType" NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "openAt" TIMESTAMP(3) NOT NULL,
    "closeAt" TIMESTAMP(3) NOT NULL,
    "settleAt" TIMESTAMP(3),
    "status" "MarketStatus" NOT NULL DEFAULT 'PENDING',
    "settlementParams" JSONB NOT NULL,
    "settlementValue" DOUBLE PRECISION,
    "settlementProof" JSONB,
    "settlementSignature" TEXT,
    "totalVolume" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalBets" INTEGER NOT NULL DEFAULT 0,
    "liquidityPool" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "oddsYes" DOUBLE PRECISION,
    "oddsNo" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "stake" DECIMAL(12,2) NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "potentialPayout" DECIMAL(12,2) NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "actualPayout" DECIMAL(12,2),
    "settledAt" TIMESTAMP(3),
    "hmacSignature" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerTxId" TEXT,
    "providerResponse" JSONB,
    "description" TEXT,
    "metadata" JSONB,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertThreshold" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT,
    "marketId" TEXT,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "actionText" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "deliveryStatus" TEXT DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "maxDailySMS" INTEGER DEFAULT 10,
    "maxEmailsPerHour" INTEGER DEFAULT 20,
    "batchEmails" BOOLEAN NOT NULL DEFAULT true,
    "batchIntervalMinutes" INTEGER DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDeliveryLog" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "errorDetails" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deviceId" TEXT,
    "appVersion" TEXT,
    "osVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivationReason" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL,
    "actionUrl" TEXT,
    "actionText" TEXT,
    "icon" TEXT,
    "imageUrl" TEXT,
    "deliveredSessions" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SMSAnalytics" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SMSAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAnalytics" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMetric" (
    "id" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "tags" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OracleProof" (
    "id" TEXT NOT NULL,
    "trendId" TEXT NOT NULL,
    "viralityScore" DECIMAL(5,4) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "proofHash" VARCHAR(64) NOT NULL,
    "merkleRoot" VARCHAR(64) NOT NULL,
    "consensusLevel" DECIMAL(3,2) NOT NULL,
    "consensusStrength" DECIMAL(5,4) NOT NULL,
    "validatorSignatures" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "networkType" VARCHAR(50) NOT NULL DEFAULT 'docker-simulated',
    "blockchainTx" VARCHAR(64),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "OracleProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidatorNode" (
    "id" TEXT NOT NULL,
    "nodeId" VARCHAR(50) NOT NULL,
    "endpoint" TEXT,
    "publicKey" VARCHAR(128),
    "version" TEXT,
    "status" "ValidatorStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeen" TIMESTAMP(3),
    "responseTime" INTEGER,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successfulRequests" INTEGER NOT NULL DEFAULT 0,
    "averageResponseTime" DECIMAL(8,2),
    "reputationScore" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "stakeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidatorNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OracleRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "trendId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'virality',
    "platform" TEXT,
    "keywords" JSONB,
    "timeframe" TEXT,
    "status" "OracleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "validatorResponses" JSONB,
    "consensusLevel" DECIMAL(3,2),
    "processingTime" INTEGER,
    "result" JSONB,
    "proofHash" VARCHAR(64),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OracleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "publicDocs" TEXT,
    "category" TEXT NOT NULL,
    "defaultPlan" TEXT NOT NULL,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiPlan" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "monthlyFee" DECIMAL(12,2) NOT NULL,
    "perCallFee" DECIMAL(12,6),
    "rateLimit" INTEGER NOT NULL,
    "burstLimit" INTEGER,
    "quota" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "broker_id" TEXT,
    "subscription_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "product_id" TEXT,
    "key" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "label" TEXT,
    "ip_whitelist" TEXT[],
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "quota_reset_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "is_sandbox" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "api_key_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "bytes_in" INTEGER NOT NULL DEFAULT 0,
    "bytes_out" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "billingRate" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiInvoice" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_type" TEXT NOT NULL,
    "billing_period_start" TIMESTAMP(3) NOT NULL,
    "billing_period_end" TIMESTAMP(3) NOT NULL,
    "amount_due" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "invoice_pdf_url" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ApiInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiWebhook" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDeliveryLog" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "request_url" TEXT NOT NULL,
    "request_body" TEXT,
    "request_headers" JSONB,
    "response_status" INTEGER,
    "response_headers" JSONB,
    "response_body" TEXT,
    "response_time" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "error_type" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "delivered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "processing_time" INTEGER,
    "signature" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_end" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerAccount" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "business_number" TEXT,
    "tax_number" TEXT,
    "vat_registered" BOOLEAN NOT NULL DEFAULT false,
    "vat_number" TEXT,
    "bankName" TEXT,
    "bank_account_number" TEXT,
    "bank_account_type" TEXT,
    "bank_branch_code" TEXT,
    "swift_code" TEXT,
    "fsca_verified" BOOLEAN NOT NULL DEFAULT false,
    "fsca_verification_date" TIMESTAMP(3),
    "riskRating" TEXT NOT NULL DEFAULT 'MEDIUM',
    "complianceStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentTerms" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerInvoice" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "broker_account_id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "subscription_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "api_usage_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transaction_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overage_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "penalty_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "BrokerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "itemType" TEXT NOT NULL,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerPayment" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "transaction_id" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "provider" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "BrokerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerSubscription" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "broker_account_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "planType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "api_calls_limit" INTEGER,
    "api_calls_used" INTEGER NOT NULL DEFAULT 0,
    "client_limit" INTEGER,
    "client_count" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB,
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "next_billing_date" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "BrokerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerNote" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "broker_account_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "reminder_date" TIMESTAMP(3),
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerDocument" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "broker_account_id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "expiry_date" TIMESTAMP(3),
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRecord" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "broker_id" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'STANDARD',
    "source" TEXT,
    "campaign" TEXT,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "total_volume" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_pnl" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "avg_trade_size" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3),
    "risk_score" DECIMAL(3,2) DEFAULT 0,
    "riskFactors" JSONB,
    "preferredContact" TEXT NOT NULL DEFAULT 'EMAIL',
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "newsletter_consent" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "tags" TEXT[],
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInteraction" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "duration" INTEGER,
    "contactMethod" TEXT,
    "contactDetails" TEXT,
    "outcome" TEXT,
    "nextAction" TEXT,
    "next_action_date" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "tags" TEXT[],
    "attachments" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stage_order" INTEGER NOT NULL,
    "color" TEXT,
    "default_probability" INTEGER NOT NULL DEFAULT 50,
    "average_duration" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerDeal" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER NOT NULL DEFAULT 50,
    "weighted_value" DECIMAL(12,2) NOT NULL,
    "expected_close_date" TIMESTAMP(3),
    "actual_close_date" TIMESTAMP(3),
    "source" TEXT,
    "campaign" TEXT,
    "contact_person" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "loss_reason" TEXT,
    "win_reason" TEXT,
    "requirements" JSONB,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealActivity" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "duration" INTEGER,
    "result" TEXT,
    "nextSteps" TEXT,
    "attachments" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "user_id" TEXT,
    "broker_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "priority_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "sla_due_date" TIMESTAMP(3) NOT NULL,
    "sla_breach" BOOLEAN NOT NULL DEFAULT false,
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "satisfaction_score" INTEGER,
    "satisfaction_comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "tags" TEXT[],
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "parent_category_id" TEXT,
    "default_sla_hours" INTEGER NOT NULL DEFAULT 24,
    "escalation_hours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPriority" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "response_time_hours" INTEGER NOT NULL,
    "resolution_time_hours" INTEGER NOT NULL,
    "notify_manager" BOOLEAN NOT NULL DEFAULT false,
    "auto_escalate" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketPriority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSLA" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "first_response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "category_ids" TEXT[],
    "priority_ids" TEXT[],
    "customer_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSLA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAssignment" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT NOT NULL,
    "reason" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_type" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "metadata" JSONB,
    "pdf_url" TEXT,
    "auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    "product_id" TEXT,
    "servicePeriod" JSONB,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "transaction_id" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processor" TEXT,
    "processor_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refund_reason" TEXT,
    "refund_date" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "parent_role_id" TEXT,
    "permissions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "department" TEXT,
    "position" TEXT,
    "reports_to_id" TEXT,
    "workEmail" TEXT,
    "workPhone" TEXT,
    "office_location" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "hire_date" TIMESTAMP(3) NOT NULL,
    "termination_date" TIMESTAMP(3),
    "performance_rating" DECIMAL(2,1),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_manager" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxIndex" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "metadata" JSONB,
    "region" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "computation_job" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpmxIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxRegionIndex" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "vts_symbol" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "contribution" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpmxRegionIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxHistory" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "open" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION DEFAULT 0,
    "change_1h" DOUBLE PRECISION,
    "change_24h" DOUBLE PRECISION,
    "change_7d" DOUBLE PRECISION,
    "rsi" DOUBLE PRECISION,
    "macd" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "components" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpmxHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxPrediction" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "model_type" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "predicted_value" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "upper_bound" DOUBLE PRECISION NOT NULL,
    "lower_bound" DOUBLE PRECISION NOT NULL,
    "features" JSONB NOT NULL,
    "actual_value" DOUBLE PRECISION,
    "error" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "VpmxPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxMarket" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "outcome_type" TEXT NOT NULL,
    "strike_price" DOUBLE PRECISION,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "resolution_criteria" TEXT NOT NULL,
    "settlement_type" TEXT NOT NULL,
    "oracle_params" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "liquidity_pool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume_24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yes_price" DOUBLE PRECISION NOT NULL,
    "no_price" DOUBLE PRECISION NOT NULL,
    "last_price" DOUBLE PRECISION,
    "created_by" TEXT NOT NULL,
    "creator_stake" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "VpmxMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxOutcome" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "probability" DOUBLE PRECISION,
    "is_winner" BOOLEAN DEFAULT false,
    "settlement_value" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpmxOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxBet" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "outcome_id" TEXT,
    "side" TEXT NOT NULL,
    "stake" DOUBLE PRECISION NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "potential_payout" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actual_payout" DOUBLE PRECISION,
    "settled_at" TIMESTAMP(3),
    "max_loss" DOUBLE PRECISION NOT NULL,
    "margin_required" DOUBLE PRECISION,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "fraud_score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpmxBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxExposure" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT,
    "vts_symbol" TEXT,
    "total_stake" DOUBLE PRECISION NOT NULL,
    "max_potential_loss" DOUBLE PRECISION NOT NULL,
    "current_pnl" DOUBLE PRECISION,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "limitType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpmxExposure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxRiskSnapshot" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "value_at_risk" DOUBLE PRECISION NOT NULL,
    "expected_shortfall" DOUBLE PRECISION NOT NULL,
    "max_drawdown" DOUBLE PRECISION NOT NULL,
    "volatility" DOUBLE PRECISION NOT NULL,
    "beta" DOUBLE PRECISION,
    "sharpe_ratio" DOUBLE PRECISION,
    "riskRating" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "market_condition" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpmxRiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxAnomaly" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "value" DOUBLE PRECISION NOT NULL,
    "expected_value" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "suggested_action" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "VpmxAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxBreakoutEvent" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "breakoutType" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "pre_breakout_value" DOUBLE PRECISION,
    "breakout_value" DOUBLE PRECISION NOT NULL,
    "current_peak" DOUBLE PRECISION,
    "predicted_peak" DOUBLE PRECISION,
    "predicted_duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,

    CONSTRAINT "VpmxBreakoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxInfluencerImpact" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "followers_count" INTEGER NOT NULL,
    "influence_score" DOUBLE PRECISION NOT NULL,
    "engagement_rate" DOUBLE PRECISION NOT NULL,
    "sentimentBias" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,

    CONSTRAINT "VpmxInfluencerImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxWeightConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "global_sentiment_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "viral_momentum_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "trend_velocity_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "mention_volume_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "engagement_quality_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "trend_stability_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "deception_risk_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "regional_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpmxWeightConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpmxAudit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entity_id" TEXT,
    "user_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "changes" JSONB,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "error_message" TEXT,
    "duration" INTEGER,
    "memory_usage" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpmxAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXHistory" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "metadata" JSONB,
    "region" TEXT,
    "computation_job" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VPMXHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXRegional" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "vts_symbol" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "contribution" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VPMXRegional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXWeighting" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "global_sentiment_weight" DOUBLE PRECISION NOT NULL,
    "viral_momentum_weight" DOUBLE PRECISION NOT NULL,
    "trend_velocity_weight" DOUBLE PRECISION NOT NULL,
    "mention_volume_weight" DOUBLE PRECISION NOT NULL,
    "engagement_quality_weight" DOUBLE PRECISION NOT NULL,
    "trend_stability_weight" DOUBLE PRECISION NOT NULL,
    "deception_risk_weight" DOUBLE PRECISION NOT NULL,
    "regional_weighting_weight" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VPMXWeighting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXMarket" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "outcome_type" TEXT NOT NULL,
    "strike_price" DOUBLE PRECISION,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "resolution_criteria" TEXT NOT NULL,
    "settlement_type" TEXT NOT NULL,
    "oracle_params" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "liquidity_pool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume_24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yes_price" DOUBLE PRECISION NOT NULL,
    "no_price" DOUBLE PRECISION NOT NULL,
    "created_by" TEXT NOT NULL,
    "creator_stake" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "VPMXMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXBet" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "stake" DOUBLE PRECISION NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "potential_payout" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "actual_payout" DOUBLE PRECISION,
    "settled_at" TIMESTAMP(3),
    "max_loss" DOUBLE PRECISION NOT NULL,
    "margin_required" DOUBLE PRECISION,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "fraud_score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VPMXBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXMarketEvent" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data" JSONB NOT NULL,
    "source" TEXT,
    "source_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VPMXMarketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXAggregates" (
    "id" TEXT NOT NULL,
    "vts_symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "open_price" DOUBLE PRECISION NOT NULL,
    "high_price" DOUBLE PRECISION NOT NULL,
    "low_price" DOUBLE PRECISION NOT NULL,
    "close_price" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mean" DOUBLE PRECISION NOT NULL,
    "median" DOUBLE PRECISION,
    "std_dev" DOUBLE PRECISION NOT NULL,
    "variance" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sample_size" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VPMXAggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXBrokerSafety" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "max_exposure" DOUBLE PRECISION NOT NULL,
    "current_exposure" DOUBLE PRECISION NOT NULL,
    "exposure_percentage" DOUBLE PRECISION NOT NULL,
    "risk_level" TEXT NOT NULL,
    "max_bet_size" DOUBLE PRECISION NOT NULL,
    "max_daily_exposure" DOUBLE PRECISION NOT NULL,
    "allowed_markets" TEXT[],
    "blocked_markets" TEXT[],
    "regions" TEXT[],
    "auto_limit_reduction" BOOLEAN NOT NULL DEFAULT false,
    "suspension_threshold" DOUBLE PRECISION NOT NULL,
    "last_risk_assessment" TIMESTAMP(3) NOT NULL,
    "assessment_score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VPMXBrokerSafety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VPMXUserFairness" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "win_rate" DOUBLE PRECISION NOT NULL,
    "avg_bet_size" DOUBLE PRECISION NOT NULL,
    "total_winnings" DOUBLE PRECISION NOT NULL,
    "total_losses" DOUBLE PRECISION NOT NULL,
    "net_profit" DOUBLE PRECISION NOT NULL,
    "total_bets" INTEGER NOT NULL,
    "fairness_score" DOUBLE PRECISION NOT NULL,
    "is_whale" BOOLEAN NOT NULL DEFAULT false,
    "limits" JSONB NOT NULL,
    "odds_adjustment" DOUBLE PRECISION NOT NULL,
    "margin_requirement" DOUBLE PRECISION NOT NULL,
    "is_restricted" BOOLEAN NOT NULL DEFAULT false,
    "restriction_reason" TEXT,
    "restriction_expires" TIMESTAMP(3),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessment_version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VPMXUserFairness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_broker_id_idx" ON "User"("broker_id");

-- CreateIndex
CREATE INDEX "User_is_deleted_idx" ON "User"("is_deleted");

-- CreateIndex
CREATE INDEX "User_deleted_at_idx" ON "User"("deleted_at");

-- CreateIndex
CREATE INDEX "User_is_active_idx" ON "User"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Broker_registrationNumber_key" ON "Broker"("registrationNumber");

-- CreateIndex
CREATE INDEX "Broker_status_idx" ON "Broker"("status");

-- CreateIndex
CREATE INDEX "Broker_tier_idx" ON "Broker"("tier");

-- CreateIndex
CREATE INDEX "Broker_isActive_idx" ON "Broker"("isActive");

-- CreateIndex
CREATE INDEX "Broker_trustScore_idx" ON "Broker"("trustScore");

-- CreateIndex
CREATE INDEX "BrokerClient_broker_id_status_idx" ON "BrokerClient"("broker_id", "status");

-- CreateIndex
CREATE INDEX "BrokerClient_client_id_attributionType_idx" ON "BrokerClient"("client_id", "attributionType");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerClient_broker_id_client_id_key" ON "BrokerClient"("broker_id", "client_id");

-- CreateIndex
CREATE INDEX "BrokerBill_broker_id_period_start_idx" ON "BrokerBill"("broker_id", "period_start");

-- CreateIndex
CREATE INDEX "BrokerBill_status_due_date_idx" ON "BrokerBill"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_slug_idx" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_category_idx" ON "Topic"("category");

-- CreateIndex
CREATE INDEX "Topic_status_idx" ON "Topic"("status");

-- CreateIndex
CREATE INDEX "IngestEvent_topicId_idx" ON "IngestEvent"("topicId");

-- CreateIndex
CREATE INDEX "IngestEvent_platform_idx" ON "IngestEvent"("platform");

-- CreateIndex
CREATE INDEX "IngestEvent_processed_idx" ON "IngestEvent"("processed");

-- CreateIndex
CREATE INDEX "IngestEvent_ingestedAt_idx" ON "IngestEvent"("ingestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SentimentSnapshot_ingestEventId_key" ON "SentimentSnapshot"("ingestEventId");

-- CreateIndex
CREATE INDEX "SentimentSnapshot_topicId_ts_idx" ON "SentimentSnapshot"("topicId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "DeceptionSnapshot_ingestEventId_key" ON "DeceptionSnapshot"("ingestEventId");

-- CreateIndex
CREATE INDEX "DeceptionSnapshot_topicId_ts_idx" ON "DeceptionSnapshot"("topicId", "ts");

-- CreateIndex
CREATE INDEX "DeceptionSnapshot_drs_idx" ON "DeceptionSnapshot"("drs");

-- CreateIndex
CREATE INDEX "ViralIndexSnapshot_topicId_ts_idx" ON "ViralIndexSnapshot"("topicId", "ts");

-- CreateIndex
CREATE INDEX "ViralIndexSnapshot_viralIndex_idx" ON "ViralIndexSnapshot"("viralIndex");

-- CreateIndex
CREATE INDEX "Market_topicId_idx" ON "Market"("topicId");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE INDEX "Market_closeAt_idx" ON "Market"("closeAt");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_marketId_idx" ON "Bet"("marketId");

-- CreateIndex
CREATE INDEX "Bet_status_idx" ON "Bet"("status");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_topicId_key" ON "Watchlist"("userId", "topicId");

-- CreateIndex
CREATE INDEX "ChatMessage_topicId_idx" ON "ChatMessage"("topicId");

-- CreateIndex
CREATE INDEX "ChatMessage_marketId_idx" ON "ChatMessage"("marketId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_category_idx" ON "Notification"("userId", "category");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_deliveryStatus_idx" ON "Notification"("deliveryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreferences_userId_key" ON "NotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "NotificationDeliveryLog_notificationId_idx" ON "NotificationDeliveryLog"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDeliveryLog_channel_status_idx" ON "NotificationDeliveryLog"("channel", "status");

-- CreateIndex
CREATE INDEX "NotificationDeliveryLog_createdAt_idx" ON "NotificationDeliveryLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- CreateIndex
CREATE INDEX "DeviceToken_token_idx" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_isActive_idx" ON "DeviceToken"("isActive");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_read_idx" ON "InAppNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "InAppNotification_expiresAt_idx" ON "InAppNotification"("expiresAt");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_type_idx" ON "VerificationCode"("userId", "type");

-- CreateIndex
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SMSAnalytics_provider_date_type_key" ON "SMSAnalytics"("provider", "date", "type");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAnalytics_template_date_key" ON "EmailAnalytics"("template", "date");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemMetric_metricName_ts_idx" ON "SystemMetric"("metricName", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "OracleProof_proofHash_key" ON "OracleProof"("proofHash");

-- CreateIndex
CREATE INDEX "OracleProof_trendId_idx" ON "OracleProof"("trendId");

-- CreateIndex
CREATE INDEX "OracleProof_proofHash_idx" ON "OracleProof"("proofHash");

-- CreateIndex
CREATE INDEX "OracleProof_createdAt_idx" ON "OracleProof"("createdAt");

-- CreateIndex
CREATE INDEX "OracleProof_networkType_idx" ON "OracleProof"("networkType");

-- CreateIndex
CREATE UNIQUE INDEX "ValidatorNode_nodeId_key" ON "ValidatorNode"("nodeId");

-- CreateIndex
CREATE INDEX "ValidatorNode_nodeId_idx" ON "ValidatorNode"("nodeId");

-- CreateIndex
CREATE INDEX "ValidatorNode_status_idx" ON "ValidatorNode"("status");

-- CreateIndex
CREATE INDEX "ValidatorNode_lastSeen_idx" ON "ValidatorNode"("lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "OracleRequest_requestId_key" ON "OracleRequest"("requestId");

-- CreateIndex
CREATE INDEX "OracleRequest_requestId_idx" ON "OracleRequest"("requestId");

-- CreateIndex
CREATE INDEX "OracleRequest_trendId_idx" ON "OracleRequest"("trendId");

-- CreateIndex
CREATE INDEX "OracleRequest_status_idx" ON "OracleRequest"("status");

-- CreateIndex
CREATE INDEX "OracleRequest_createdAt_idx" ON "OracleRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiProduct_slug_key" ON "ApiProduct"("slug");

-- CreateIndex
CREATE INDEX "ApiProduct_slug_idx" ON "ApiProduct"("slug");

-- CreateIndex
CREATE INDEX "ApiProduct_category_idx" ON "ApiProduct"("category");

-- CreateIndex
CREATE INDEX "ApiProduct_isActive_idx" ON "ApiProduct"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ApiPlan_code_key" ON "ApiPlan"("code");

-- CreateIndex
CREATE INDEX "ApiPlan_product_id_idx" ON "ApiPlan"("product_id");

-- CreateIndex
CREATE INDEX "ApiPlan_code_idx" ON "ApiPlan"("code");

-- CreateIndex
CREATE INDEX "ApiPlan_isActive_idx" ON "ApiPlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_user_id_idx" ON "ApiKey"("user_id");

-- CreateIndex
CREATE INDEX "ApiKey_broker_id_idx" ON "ApiKey"("broker_id");

-- CreateIndex
CREATE INDEX "ApiKey_subscription_id_idx" ON "ApiKey"("subscription_id");

-- CreateIndex
CREATE INDEX "ApiKey_plan_id_idx" ON "ApiKey"("plan_id");

-- CreateIndex
CREATE INDEX "ApiKey_product_id_idx" ON "ApiKey"("product_id");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_revoked_idx" ON "ApiKey"("revoked");

-- CreateIndex
CREATE INDEX "ApiUsage_subscription_id_createdAt_idx" ON "ApiUsage"("subscription_id", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_api_key_id_createdAt_idx" ON "ApiUsage"("api_key_id", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_product_id_createdAt_idx" ON "ApiUsage"("product_id", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "ApiInvoice_customer_id_createdAt_idx" ON "ApiInvoice"("customer_id", "createdAt");

-- CreateIndex
CREATE INDEX "ApiInvoice_status_idx" ON "ApiInvoice"("status");

-- CreateIndex
CREATE INDEX "ApiInvoice_billing_period_start_idx" ON "ApiInvoice"("billing_period_start");

-- CreateIndex
CREATE INDEX "ApiWebhook_user_id_idx" ON "ApiWebhook"("user_id");

-- CreateIndex
CREATE INDEX "ApiWebhook_is_active_idx" ON "ApiWebhook"("is_active");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_webhook_id_status_idx" ON "WebhookDeliveryLog"("webhook_id", "status");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_webhook_id_event_idx" ON "WebhookDeliveryLog"("webhook_id", "event");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_status_createdAt_idx" ON "WebhookDeliveryLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_delivered_at_idx" ON "WebhookDeliveryLog"("delivered_at");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_retry_count_idx" ON "WebhookDeliveryLog"("retry_count");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_error_type_idx" ON "WebhookDeliveryLog"("error_type");

-- CreateIndex
CREATE INDEX "WebhookDeliveryLog_response_status_idx" ON "WebhookDeliveryLog"("response_status");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitCounter_key_key" ON "RateLimitCounter"("key");

-- CreateIndex
CREATE INDEX "RateLimitCounter_key_idx" ON "RateLimitCounter"("key");

-- CreateIndex
CREATE INDEX "RateLimitCounter_window_end_idx" ON "RateLimitCounter"("window_end");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerAccount_broker_id_key" ON "BrokerAccount"("broker_id");

-- CreateIndex
CREATE INDEX "BrokerAccount_broker_id_idx" ON "BrokerAccount"("broker_id");

-- CreateIndex
CREATE INDEX "BrokerAccount_status_idx" ON "BrokerAccount"("status");

-- CreateIndex
CREATE INDEX "BrokerAccount_complianceStatus_idx" ON "BrokerAccount"("complianceStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerInvoice_invoiceNumber_key" ON "BrokerInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "BrokerInvoice_broker_id_status_idx" ON "BrokerInvoice"("broker_id", "status");

-- CreateIndex
CREATE INDEX "BrokerInvoice_due_date_status_idx" ON "BrokerInvoice"("due_date", "status");

-- CreateIndex
CREATE INDEX "BrokerInvoice_invoiceNumber_idx" ON "BrokerInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "BrokerInvoiceItem_invoice_id_idx" ON "BrokerInvoiceItem"("invoice_id");

-- CreateIndex
CREATE INDEX "BrokerInvoiceItem_itemType_idx" ON "BrokerInvoiceItem"("itemType");

-- CreateIndex
CREATE INDEX "BrokerPayment_broker_id_status_idx" ON "BrokerPayment"("broker_id", "status");

-- CreateIndex
CREATE INDEX "BrokerPayment_invoice_id_idx" ON "BrokerPayment"("invoice_id");

-- CreateIndex
CREATE INDEX "BrokerPayment_payment_date_idx" ON "BrokerPayment"("payment_date");

-- CreateIndex
CREATE INDEX "BrokerSubscription_broker_id_status_idx" ON "BrokerSubscription"("broker_id", "status");

-- CreateIndex
CREATE INDEX "BrokerSubscription_next_billing_date_idx" ON "BrokerSubscription"("next_billing_date");

-- CreateIndex
CREATE INDEX "BrokerSubscription_tier_idx" ON "BrokerSubscription"("tier");

-- CreateIndex
CREATE INDEX "BrokerNote_broker_id_category_idx" ON "BrokerNote"("broker_id", "category");

-- CreateIndex
CREATE INDEX "BrokerNote_author_id_idx" ON "BrokerNote"("author_id");

-- CreateIndex
CREATE INDEX "BrokerNote_reminder_date_idx" ON "BrokerNote"("reminder_date");

-- CreateIndex
CREATE INDEX "BrokerDocument_broker_id_documentType_idx" ON "BrokerDocument"("broker_id", "documentType");

-- CreateIndex
CREATE INDEX "BrokerDocument_status_expiry_date_idx" ON "BrokerDocument"("status", "expiry_date");

-- CreateIndex
CREATE INDEX "BrokerDocument_uploaded_by_idx" ON "BrokerDocument"("uploaded_by");

-- CreateIndex
CREATE INDEX "ClientRecord_broker_id_segment_idx" ON "ClientRecord"("broker_id", "segment");

-- CreateIndex
CREATE INDEX "ClientRecord_segment_status_idx" ON "ClientRecord"("segment", "status");

-- CreateIndex
CREATE INDEX "ClientRecord_last_activity_at_idx" ON "ClientRecord"("last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRecord_user_id_key" ON "ClientRecord"("user_id");

-- CreateIndex
CREATE INDEX "ClientInteraction_client_id_createdAt_idx" ON "ClientInteraction"("client_id", "createdAt");

-- CreateIndex
CREATE INDEX "ClientInteraction_staff_id_createdAt_idx" ON "ClientInteraction"("staff_id", "createdAt");

-- CreateIndex
CREATE INDEX "ClientInteraction_type_direction_idx" ON "ClientInteraction"("type", "direction");

-- CreateIndex
CREATE INDEX "ClientInteraction_next_action_date_idx" ON "ClientInteraction"("next_action_date");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_stage_order_key" ON "PipelineStage"("stage_order");

-- CreateIndex
CREATE INDEX "PipelineStage_stage_order_idx" ON "PipelineStage"("stage_order");

-- CreateIndex
CREATE INDEX "BrokerDeal_broker_id_status_idx" ON "BrokerDeal"("broker_id", "status");

-- CreateIndex
CREATE INDEX "BrokerDeal_stage_id_idx" ON "BrokerDeal"("stage_id");

-- CreateIndex
CREATE INDEX "BrokerDeal_assigned_to_id_idx" ON "BrokerDeal"("assigned_to_id");

-- CreateIndex
CREATE INDEX "BrokerDeal_expected_close_date_idx" ON "BrokerDeal"("expected_close_date");

-- CreateIndex
CREATE INDEX "DealActivity_deal_id_createdAt_idx" ON "DealActivity"("deal_id", "createdAt");

-- CreateIndex
CREATE INDEX "DealActivity_author_id_idx" ON "DealActivity"("author_id");

-- CreateIndex
CREATE INDEX "DealActivity_type_idx" ON "DealActivity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_status_priority_id_idx" ON "Ticket"("status", "priority_id");

-- CreateIndex
CREATE INDEX "Ticket_assigned_to_id_status_idx" ON "Ticket"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "Ticket_sla_due_date_sla_breach_idx" ON "Ticket"("sla_due_date", "sla_breach");

-- CreateIndex
CREATE INDEX "Ticket_user_id_createdAt_idx" ON "Ticket"("user_id", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_broker_id_createdAt_idx" ON "Ticket"("broker_id", "createdAt");

-- CreateIndex
CREATE INDEX "TicketCategory_is_active_idx" ON "TicketCategory"("is_active");

-- CreateIndex
CREATE INDEX "TicketCategory_parent_category_id_idx" ON "TicketCategory"("parent_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "TicketPriority_level_key" ON "TicketPriority"("level");

-- CreateIndex
CREATE INDEX "TicketPriority_is_active_idx" ON "TicketPriority"("is_active");

-- CreateIndex
CREATE INDEX "TicketMessage_ticket_id_createdAt_idx" ON "TicketMessage"("ticket_id", "createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_author_id_idx" ON "TicketMessage"("author_id");

-- CreateIndex
CREATE INDEX "TicketAssignment_ticket_id_is_current_idx" ON "TicketAssignment"("ticket_id", "is_current");

-- CreateIndex
CREATE INDEX "TicketAssignment_assigned_to_id_createdAt_idx" ON "TicketAssignment"("assigned_to_id", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_customer_id_status_idx" ON "Invoice"("customer_id", "status");

-- CreateIndex
CREATE INDEX "Invoice_type_status_idx" ON "Invoice"("type", "status");

-- CreateIndex
CREATE INDEX "Invoice_due_date_status_idx" ON "Invoice"("due_date", "status");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoice_id_idx" ON "InvoiceItem"("invoice_id");

-- CreateIndex
CREATE INDEX "InvoiceItem_category_idx" ON "InvoiceItem"("category");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoice_id_idx" ON "InvoicePayment"("invoice_id");

-- CreateIndex
CREATE INDEX "InvoicePayment_status_payment_date_idx" ON "InvoicePayment"("status", "payment_date");

-- CreateIndex
CREATE INDEX "StaffRole_is_active_idx" ON "StaffRole"("is_active");

-- CreateIndex
CREATE INDEX "StaffRole_department_idx" ON "StaffRole"("department");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_user_id_key" ON "StaffMember"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_employee_id_key" ON "StaffMember"("employee_id");

-- CreateIndex
CREATE INDEX "StaffMember_user_id_idx" ON "StaffMember"("user_id");

-- CreateIndex
CREATE INDEX "StaffMember_role_id_is_active_idx" ON "StaffMember"("role_id", "is_active");

-- CreateIndex
CREATE INDEX "StaffMember_department_is_active_idx" ON "StaffMember"("department", "is_active");

-- CreateIndex
CREATE INDEX "VpmxIndex_vts_symbol_timestamp_idx" ON "VpmxIndex"("vts_symbol", "timestamp");

-- CreateIndex
CREATE INDEX "VpmxIndex_timestamp_idx" ON "VpmxIndex"("timestamp");

-- CreateIndex
CREATE INDEX "VpmxIndex_value_idx" ON "VpmxIndex"("value");

-- CreateIndex
CREATE INDEX "VpmxIndex_region_idx" ON "VpmxIndex"("region");

-- CreateIndex
CREATE INDEX "VpmxIndex_computation_job_idx" ON "VpmxIndex"("computation_job");

-- CreateIndex
CREATE INDEX "VpmxRegionIndex_region_timestamp_idx" ON "VpmxRegionIndex"("region", "timestamp");

-- CreateIndex
CREATE INDEX "VpmxRegionIndex_vts_symbol_region_idx" ON "VpmxRegionIndex"("vts_symbol", "region");

-- CreateIndex
CREATE INDEX "VpmxRegionIndex_timestamp_idx" ON "VpmxRegionIndex"("timestamp");

-- CreateIndex
CREATE INDEX "VpmxHistory_vts_symbol_timestamp_idx" ON "VpmxHistory"("vts_symbol", "timestamp");

-- CreateIndex
CREATE INDEX "VpmxHistory_timestamp_idx" ON "VpmxHistory"("timestamp");

-- CreateIndex
CREATE INDEX "VpmxHistory_value_idx" ON "VpmxHistory"("value");

-- CreateIndex
CREATE INDEX "VpmxPrediction_vts_symbol_status_idx" ON "VpmxPrediction"("vts_symbol", "status");

-- CreateIndex
CREATE INDEX "VpmxPrediction_horizon_idx" ON "VpmxPrediction"("horizon");

-- CreateIndex
CREATE INDEX "VpmxPrediction_timestamp_idx" ON "VpmxPrediction"("timestamp");

-- CreateIndex
CREATE INDEX "VpmxMarket_vts_symbol_status_idx" ON "VpmxMarket"("vts_symbol", "status");

-- CreateIndex
CREATE INDEX "VpmxMarket_expiry_date_status_idx" ON "VpmxMarket"("expiry_date", "status");

-- CreateIndex
CREATE INDEX "VpmxMarket_outcome_type_idx" ON "VpmxMarket"("outcome_type");

-- CreateIndex
CREATE INDEX "VpmxMarket_created_by_idx" ON "VpmxMarket"("created_by");

-- CreateIndex
CREATE INDEX "VpmxOutcome_market_id_idx" ON "VpmxOutcome"("market_id");

-- CreateIndex
CREATE INDEX "VpmxBet_user_id_status_idx" ON "VpmxBet"("user_id", "status");

-- CreateIndex
CREATE INDEX "VpmxBet_market_id_status_idx" ON "VpmxBet"("market_id", "status");

-- CreateIndex
CREATE INDEX "VpmxBet_createdAt_idx" ON "VpmxBet"("createdAt");

-- CreateIndex
CREATE INDEX "VpmxExposure_user_id_status_idx" ON "VpmxExposure"("user_id", "status");

-- CreateIndex
CREATE INDEX "VpmxExposure_market_id_idx" ON "VpmxExposure"("market_id");

-- CreateIndex
CREATE INDEX "VpmxExposure_vts_symbol_idx" ON "VpmxExposure"("vts_symbol");

-- CreateIndex
CREATE INDEX "VpmxExposure_riskLevel_idx" ON "VpmxExposure"("riskLevel");

-- CreateIndex
CREATE INDEX "VpmxExposure_deletedAt_idx" ON "VpmxExposure"("deletedAt");

-- CreateIndex
CREATE INDEX "VpmxRiskSnapshot_vts_symbol_idx" ON "VpmxRiskSnapshot"("vts_symbol");

-- CreateIndex
CREATE INDEX "VpmxRiskSnapshot_timestamp_idx" ON "VpmxRiskSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "VpmxRiskSnapshot_riskRating_idx" ON "VpmxRiskSnapshot"("riskRating");

-- CreateIndex
CREATE INDEX "VpmxAnomaly_vts_symbol_status_idx" ON "VpmxAnomaly"("vts_symbol", "status");

-- CreateIndex
CREATE INDEX "VpmxAnomaly_severity_idx" ON "VpmxAnomaly"("severity");

-- CreateIndex
CREATE INDEX "VpmxAnomaly_detected_at_idx" ON "VpmxAnomaly"("detected_at");

-- CreateIndex
CREATE INDEX "VpmxBreakoutEvent_vts_symbol_status_idx" ON "VpmxBreakoutEvent"("vts_symbol", "status");

-- CreateIndex
CREATE INDEX "VpmxBreakoutEvent_breakoutType_idx" ON "VpmxBreakoutEvent"("breakoutType");

-- CreateIndex
CREATE INDEX "VpmxBreakoutEvent_detected_at_idx" ON "VpmxBreakoutEvent"("detected_at");

-- CreateIndex
CREATE INDEX "VpmxInfluencerImpact_vts_symbol_platform_idx" ON "VpmxInfluencerImpact"("vts_symbol", "platform");

-- CreateIndex
CREATE INDEX "VpmxInfluencerImpact_handle_idx" ON "VpmxInfluencerImpact"("handle");

-- CreateIndex
CREATE INDEX "VpmxInfluencerImpact_status_idx" ON "VpmxInfluencerImpact"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VpmxWeightConfig_name_key" ON "VpmxWeightConfig"("name");

-- CreateIndex
CREATE INDEX "VpmxWeightConfig_is_active_idx" ON "VpmxWeightConfig"("is_active");

-- CreateIndex
CREATE INDEX "VpmxWeightConfig_is_default_idx" ON "VpmxWeightConfig"("is_default");

-- CreateIndex
CREATE INDEX "VpmxAudit_action_entityType_idx" ON "VpmxAudit"("action", "entityType");

-- CreateIndex
CREATE INDEX "VpmxAudit_user_id_idx" ON "VpmxAudit"("user_id");

-- CreateIndex
CREATE INDEX "VpmxAudit_timestamp_idx" ON "VpmxAudit"("timestamp");

-- CreateIndex
CREATE INDEX "VpmxAudit_status_idx" ON "VpmxAudit"("status");

-- CreateIndex
CREATE INDEX "VPMXHistory_vts_symbol_timestamp_idx" ON "VPMXHistory"("vts_symbol", "timestamp");

-- CreateIndex
CREATE INDEX "VPMXHistory_timestamp_idx" ON "VPMXHistory"("timestamp");

-- CreateIndex
CREATE INDEX "VPMXHistory_value_idx" ON "VPMXHistory"("value");

-- CreateIndex
CREATE INDEX "VPMXHistory_region_idx" ON "VPMXHistory"("region");

-- CreateIndex
CREATE INDEX "VPMXHistory_computation_job_idx" ON "VPMXHistory"("computation_job");

-- CreateIndex
CREATE INDEX "VPMXRegional_region_timestamp_idx" ON "VPMXRegional"("region", "timestamp");

-- CreateIndex
CREATE INDEX "VPMXRegional_vts_symbol_region_idx" ON "VPMXRegional"("vts_symbol", "region");

-- CreateIndex
CREATE INDEX "VPMXRegional_timestamp_idx" ON "VPMXRegional"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "VPMXWeighting_name_key" ON "VPMXWeighting"("name");

-- CreateIndex
CREATE INDEX "VPMXWeighting_is_active_idx" ON "VPMXWeighting"("is_active");

-- CreateIndex
CREATE INDEX "VPMXWeighting_is_default_idx" ON "VPMXWeighting"("is_default");

-- CreateIndex
CREATE INDEX "VPMXMarket_vts_symbol_status_idx" ON "VPMXMarket"("vts_symbol", "status");

-- CreateIndex
CREATE INDEX "VPMXMarket_expiry_date_status_idx" ON "VPMXMarket"("expiry_date", "status");

-- CreateIndex
CREATE INDEX "VPMXMarket_outcome_type_idx" ON "VPMXMarket"("outcome_type");

-- CreateIndex
CREATE INDEX "VPMXMarket_created_by_idx" ON "VPMXMarket"("created_by");

-- CreateIndex
CREATE INDEX "VPMXBet_user_id_status_idx" ON "VPMXBet"("user_id", "status");

-- CreateIndex
CREATE INDEX "VPMXBet_market_id_status_idx" ON "VPMXBet"("market_id", "status");

-- CreateIndex
CREATE INDEX "VPMXBet_createdAt_idx" ON "VPMXBet"("createdAt");

-- CreateIndex
CREATE INDEX "VPMXMarketEvent_market_id_event_type_idx" ON "VPMXMarketEvent"("market_id", "event_type");

-- CreateIndex
CREATE INDEX "VPMXMarketEvent_timestamp_idx" ON "VPMXMarketEvent"("timestamp");

-- CreateIndex
CREATE INDEX "VPMXAggregates_vts_symbol_interval_idx" ON "VPMXAggregates"("vts_symbol", "interval");

-- CreateIndex
CREATE INDEX "VPMXAggregates_timestamp_idx" ON "VPMXAggregates"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "VPMXAggregates_vts_symbol_interval_timestamp_key" ON "VPMXAggregates"("vts_symbol", "interval", "timestamp");

-- CreateIndex
CREATE INDEX "VPMXBrokerSafety_risk_level_idx" ON "VPMXBrokerSafety"("risk_level");

-- CreateIndex
CREATE INDEX "VPMXBrokerSafety_exposure_percentage_idx" ON "VPMXBrokerSafety"("exposure_percentage");

-- CreateIndex
CREATE UNIQUE INDEX "VPMXBrokerSafety_broker_id_key" ON "VPMXBrokerSafety"("broker_id");

-- CreateIndex
CREATE INDEX "VPMXUserFairness_fairness_score_idx" ON "VPMXUserFairness"("fairness_score");

-- CreateIndex
CREATE INDEX "VPMXUserFairness_is_whale_idx" ON "VPMXUserFairness"("is_whale");

-- CreateIndex
CREATE INDEX "VPMXUserFairness_is_restricted_idx" ON "VPMXUserFairness"("is_restricted");

-- CreateIndex
CREATE INDEX "VPMXUserFairness_deletedAt_idx" ON "VPMXUserFairness"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VPMXUserFairness_user_id_key" ON "VPMXUserFairness"("user_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerClient" ADD CONSTRAINT "BrokerClient_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerClient" ADD CONSTRAINT "BrokerClient_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerBill" ADD CONSTRAINT "BrokerBill_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestEvent" ADD CONSTRAINT "IngestEvent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentSnapshot" ADD CONSTRAINT "SentimentSnapshot_ingestEventId_fkey" FOREIGN KEY ("ingestEventId") REFERENCES "IngestEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeceptionSnapshot" ADD CONSTRAINT "DeceptionSnapshot_ingestEventId_fkey" FOREIGN KEY ("ingestEventId") REFERENCES "IngestEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViralIndexSnapshot" ADD CONSTRAINT "ViralIndexSnapshot_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDeliveryLog" ADD CONSTRAINT "NotificationDeliveryLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OracleProof" ADD CONSTRAINT "OracleProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiPlan" ADD CONSTRAINT "ApiPlan_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ApiProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "BrokerSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "ApiPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ApiProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "BrokerSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ApiProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryLog" ADD CONSTRAINT "WebhookDeliveryLog_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "ApiWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerAccount" ADD CONSTRAINT "BrokerAccount_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerInvoice" ADD CONSTRAINT "BrokerInvoice_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerInvoice" ADD CONSTRAINT "BrokerInvoice_broker_account_id_fkey" FOREIGN KEY ("broker_account_id") REFERENCES "BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerInvoiceItem" ADD CONSTRAINT "BrokerInvoiceItem_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "BrokerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerPayment" ADD CONSTRAINT "BrokerPayment_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerPayment" ADD CONSTRAINT "BrokerPayment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "BrokerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerSubscription" ADD CONSTRAINT "BrokerSubscription_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerSubscription" ADD CONSTRAINT "BrokerSubscription_broker_account_id_fkey" FOREIGN KEY ("broker_account_id") REFERENCES "BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerNote" ADD CONSTRAINT "BrokerNote_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerNote" ADD CONSTRAINT "BrokerNote_broker_account_id_fkey" FOREIGN KEY ("broker_account_id") REFERENCES "BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerNote" ADD CONSTRAINT "BrokerNote_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDocument" ADD CONSTRAINT "BrokerDocument_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDocument" ADD CONSTRAINT "BrokerDocument_broker_account_id_fkey" FOREIGN KEY ("broker_account_id") REFERENCES "BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDocument" ADD CONSTRAINT "BrokerDocument_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDocument" ADD CONSTRAINT "BrokerDocument_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRecord" ADD CONSTRAINT "ClientRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRecord" ADD CONSTRAINT "ClientRecord_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInteraction" ADD CONSTRAINT "ClientInteraction_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "ClientRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInteraction" ADD CONSTRAINT "ClientInteraction_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDeal" ADD CONSTRAINT "BrokerDeal_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDeal" ADD CONSTRAINT "BrokerDeal_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDeal" ADD CONSTRAINT "BrokerDeal_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "BrokerDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "TicketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "TicketPriority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "StaffRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "StaffRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpmxOutcome" ADD CONSTRAINT "VpmxOutcome_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "VpmxMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpmxBet" ADD CONSTRAINT "VpmxBet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpmxBet" ADD CONSTRAINT "VpmxBet_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "VpmxMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpmxBet" ADD CONSTRAINT "VpmxBet_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "VpmxOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpmxExposure" ADD CONSTRAINT "VpmxExposure_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPMXBet" ADD CONSTRAINT "VPMXBet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPMXBet" ADD CONSTRAINT "VPMXBet_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "VPMXMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPMXMarketEvent" ADD CONSTRAINT "VPMXMarketEvent_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "VPMXMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VPMXUserFairness" ADD CONSTRAINT "VPMXUserFairness_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

