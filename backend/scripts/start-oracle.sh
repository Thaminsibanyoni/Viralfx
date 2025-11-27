#!/bin/bash

# Social Sentiment Oracle Startup Script
# This script starts the complete Oracle network locally

set -e

echo "🚀 Starting ViralFX Social Sentiment Oracle Network..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[ORACLE]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Create environment file if it doesn't exist
ENV_FILE="./.env.oracle"
if [ ! -f "$ENV_FILE" ]; then
    print_status "Creating Oracle environment file..."
    cat > "$ENV_FILE" << EOF
# Oracle Network Configuration
VALIDATOR_KEY_1=validator-node-1-secret-key-$(openssl rand -hex 16)
VALIDATOR_KEY_2=validator-node-2-secret-key-$(openssl rand -hex 16)
VALIDATOR_KEY_3=validator-node-3-secret-key-$(openssl rand -hex 16)

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5433/viralfx

# Redis Configuration
REDIS_URL=redis://localhost:6380

# Oracle Configuration
ORACLE_VALIDATOR_NETWORK=true
ORACLE_COORDINATOR_PORT=3000
VALIDATOR_NODES=validator-node-1:3002,validator-node-2:3003,validator-node-3:3004

# Security
JWT_SECRET=oracle-jwt-secret-key-$(openssl rand -hex 32)
EOF
    print_status "Environment file created at $ENV_FILE"
fi

# Load environment variables
source "$ENV_FILE"

# Function to check if a service is healthy
wait_for_service() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be healthy..."

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            print_status "$service_name is healthy! ✓"
            return 0
        fi

        print_warning "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        ((attempt++))
    done

    print_error "$service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Stop any existing Oracle network
print_header "Stopping any existing Oracle network..."
docker-compose -f docker-compose.oracle.yml down --remove-orphans 2>/dev/null || true

# Build and start the Oracle network
print_header "Building Oracle network containers..."
docker-compose -f docker-compose.oracle.yml build

print_header "Starting Oracle network..."
docker-compose -f docker-compose.oracle.yml up -d

# Wait for core services
print_header "Waiting for core services to be ready..."

wait_for_service "PostgreSQL" "http://localhost:5433" || {
    print_error "PostgreSQL failed to start"
    docker-compose -f docker-compose.oracle.yml logs postgres
    exit 1
}

wait_for_service "Redis" "http://localhost:6380" || {
    print_error "Redis failed to start"
    docker-compose -f docker-compose.oracle.yml logs redis
    exit 1
}

# Wait for validator nodes
wait_for_service "Validator Node 1" "http://localhost:3002/health" || {
    print_error "Validator Node 1 failed to start"
    docker-compose -f docker-compose.oracle.yml logs validator-node-1
    exit 1
}

wait_for_service "Validator Node 2" "http://localhost:3003/health" || {
    print_error "Validator Node 2 failed to start"
    docker-compose -f docker-compose.oracle.yml logs validator-node-2
    exit 1
}

wait_for_service "Validator Node 3" "http://localhost:3004/health" || {
    print_error "Validator Node 3 failed to start"
    docker-compose -f docker-compose.oracle.yml logs validator-node-3
    exit 1
}

wait_for_service "Oracle Coordinator" "http://localhost:3001/api/oracle/health" || {
    print_error "Oracle Coordinator failed to start"
    docker-compose -f docker-compose.oracle.yml logs oracle-coordinator
    exit 1
}

# Run database migrations
print_header "Running database migrations..."
docker-compose -f docker-compose.oracle.yml exec oracle-coordinator npm run prisma:migrate

# Test the Oracle network
print_header "Testing Oracle network..."

# Test oracle status
print_status "Testing Oracle status endpoint..."
ORACLE_STATUS=$(curl -s http://localhost:3001/api/oracle/status | jq -r '.status // "unknown"')
if [ "$ORACLE_STATUS" = "active" ]; then
    print_status "Oracle status: ACTIVE ✓"
else
    print_error "Oracle status: $ORACLE_STATUS ✗"
fi

# Test validator health
print_status "Testing validator health..."
VALIDATOR_HEALTH=$(curl -s http://localhost:3001/api/validators/health | jq -r '.healthyValidators // "unknown"')
print_status "Healthy validators: $VALIDATOR_HEALTH/3"

# Test a sample oracle request
print_status "Testing sample oracle request..."
SAMPLE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/oracle/virality \
    -H "Content-Type: application/json" \
    -d '{"trendId": "test-trend-001", "dataType": "virality"}')

if echo "$SAMPLE_RESPONSE" | jq -e '.viralityScore' > /dev/null 2>&1; then
    VIRALITY_SCORE=$(echo "$SAMPLE_RESPONSE" | jq -r '.viralityScore')
    PROOF_HASH=$(echo "$SAMPLE_RESPONSE" | jq -r '.proofHash' | cut -c1-16)
    print_status "Sample request successful! Score: $VIRALITY_SCORE, Proof: $PROOF_HASH..."
else
    print_warning "Sample request failed. Check logs for details."
fi

# Print access information
print_header "🎉 Oracle Network is Ready!"
echo "=================================================="
echo ""
print_status "📊 Oracle Coordinator: http://localhost:3001"
print_status "🔍 API Documentation: http://localhost:3001/api/docs"
print_status "💚 Validator Node 1: http://localhost:3002"
print_status "💚 Validator Node 2: http://localhost:3003"
print_status "💚 Validator Node 3: http://localhost:3004"
print_status "🌐 Oracle Dashboard: http://localhost:5174"
print_status "🗄️  PostgreSQL: localhost:5433"
print_status "🔴 Redis: localhost:6380"
echo ""
print_status "📖 API Endpoints:"
echo "  • GET  /api/oracle/status - Oracle network status"
echo "  • POST /api/oracle/virality - Get virality score"
echo "  • GET  /api/oracle/virality/:trendId - Get latest score"
echo "  • GET  /api/oracle/proof/:hash/verify - Verify proof"
echo "  • GET  /api/validators/health - Validator health"
echo "  • GET  /api/validators/metrics - Validator metrics"
echo ""
print_status "🛠️ Management Commands:"
echo "  • View logs: docker-compose -f docker-compose.oracle.yml logs -f"
echo "  • Stop network: docker-compose -f docker-compose.oracle.yml down"
echo "  • Restart: docker-compose -f docker-compose.oracle.yml restart"
echo ""
print_warning "To stop the Oracle network, run: ./scripts/stop-oracle.sh"
echo ""

# Keep script running or exit based on parameter
if [ "$1" = "--daemon" ]; then
    print_status "Oracle network started in daemon mode"
    exit 0
else
    print_status "Press Ctrl+C to stop the Oracle network"
    print_status "Monitoring Oracle network logs..."
    docker-compose -f docker-compose.oracle.yml logs -f
fi