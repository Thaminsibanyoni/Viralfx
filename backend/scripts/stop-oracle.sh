#!/bin/bash

# Social Sentiment Oracle Stop Script
# This script stops the Oracle network and cleans up resources

set -e

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

print_header "Stopping ViralFX Social Sentiment Oracle Network..."
echo "=================================================="

# Check if docker-compose file exists
if [ ! -f "docker-compose.oracle.yml" ]; then
    print_error "docker-compose.oracle.yml not found. Are you in the correct directory?"
    exit 1
fi

# Stop and remove containers
print_status "Stopping Oracle network containers..."
docker-compose -f docker-compose.oracle.yml down --remove-orphans

# Remove stopped containers (optional)
if [ "$1" = "--clean" ]; then
    print_status "Removing stopped containers..."
    docker-compose -f docker-compose.oracle.yml down --remove-orphans --volumes --remove-orphans

    # Clean up unused Docker resources
    print_status "Cleaning up unused Docker resources..."
    docker system prune -f

    print_warning "Database volumes have been removed. All data will be lost."
fi

# Check if any containers are still running
RUNNING_CONTAINERS=$(docker ps -q --filter "name=viralfx" | wc -l)
if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
    print_warning "Some ViralFX containers are still running. Forcing cleanup..."
    docker ps -q --filter "name=viralfx" | xargs -r docker stop
    docker ps -aq --filter "name=viralfx" | xargs -r docker rm
fi

# Check if ports are still in use
print_status "Checking if ports are still in use..."
for port in 3001 3002 3003 3004 5433 6380 5174; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $port is still in use by another process."
    else
        print_status "Port $port is free."
    fi
done

print_header "🛑 Oracle Network Stopped!"
echo "=================================================="
echo ""
print_status "✅ All Oracle containers have been stopped."
print_status "✅ Network resources have been cleaned up."
echo ""

if [ "$1" != "--clean" ]; then
    print_status "💡 To completely remove all data (including database), run:"
    echo "   ./scripts/stop-oracle.sh --clean"
    echo ""
fi

print_status "💡 To start the Oracle network again, run:"
echo "   ./scripts/start-oracle.sh"
echo ""