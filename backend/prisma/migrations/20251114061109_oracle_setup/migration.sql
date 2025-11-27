-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'MODERATOR', 'ANALYST');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TWITTER', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'REDDIT', 'DISCORD', 'TELEGRAM', 'CUSTOM');

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
CREATE TYPE "NotificationType" AS ENUM ('BET_SETTLED', 'MARKET_CLOSED', 'MARKET_PAUSED', 'DEPOSIT_CONFIRMED', 'WITHDRAWAL_PROCESSED', 'KYC_APPROVED', 'KYC_REJECTED', 'ALERT_TRIGGERED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ValidatorStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OracleRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

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
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OracleProof" ADD CONSTRAINT "OracleProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
