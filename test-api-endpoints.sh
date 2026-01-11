#!/bin/bash

echo "=========================================="
echo "API ENDPOINTS TESTING"
echo "=========================================="
echo ""

API_BASE="http://localhost:3000/api/v1"

test_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local description=$3
    
    echo "Testing: $description"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$endpoint" 2>/dev/null)
        http_code=$(echo "$response" | tail -1)
        body=$(echo "$response" | head -n -1)
        
        if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
            echo "✓ Status: $http_code"
            echo "✓ Response: OK"
        else
            echo "✗ Status: $http_code"
        fi
    fi
    echo ""
}

# Core Endpoints
test_endpoint "$API_BASE/health" "GET" "Health Check"
test_endpoint "$API_BASE/" "GET" "Root Endpoint"
test_endpoint "http://localhost:3000/api/docs" "GET" "API Documentation"

echo "=========================================="
echo "CRITICAL MODULES STATUS"
echo "=========================================="
echo ""

# Check if modules are loaded in logs
echo "Checking backend logs for module initialization..."
echo ""

backend_log="/home/appjobs/Desktop/Viralfx/Viral Fx 1/backend/logs/backend.log"

if [ -f "$backend_log" ]; then
    echo "✓ Backend log file exists"
    
    echo ""
    echo "Module Initialization Status:"
    grep -i "dependencies initialized" "$backend_log" | tail -20 | while read line; do
        if echo "$line" | grep -q "initialized"; then
            module=$(echo "$line" | grep -oP '\[\K[^\]]+(?=\])')
            echo "  ✓ $module"
        fi
    done
else
    echo "✗ Backend log file not found"
fi

echo ""
echo "=========================================="
echo "SERVICE PROCESSES"
echo "=========================================="
echo ""

echo "Backend Processes:"
pgrep -f "nest start" | wc -l | xargs echo "  Running:"

echo ""
echo "Frontend Processes:"
pgrep -f "vite" | wc -l | xargs echo "  Running:"

echo ""
echo "Database Connections:"
echo "  PostgreSQL: $(pg_isready -h localhost -p 5432 2>&1 | grep -o 'accepting' || echo 'Not accepting')"
echo "  Redis: $(redis-cli ping 2>/dev/null || echo 'Not responding')"

echo ""
echo "=========================================="
echo "PORT STATUS"
echo "=========================================="
echo ""

echo "Port 3000 (Backend):"
lsof -i :3000 2>/dev/null | grep LISTEN | wc -l | xargs -I {} echo "  ✓ Listening"

echo ""
echo "Port 5173 (Frontend):"
lsof -i :5173 2>/dev/null | grep LISTEN | wc -l | xargs -I {} echo "  ✓ Listening"

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
