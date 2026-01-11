#!/bin/bash

echo "=========================================="
echo "VIRALFX - COMPREHENSIVE MODULE VERIFICATION"
echo "=========================================="
echo "Started: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if eval "$1"; then
        echo -e "${GREEN}✓${NC} $2"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

echo "=========================================="
echo "1. SERVICES STATUS"
echo "=========================================="
check "pgrep -f 'nest start' > /dev/null" "Backend Process Running"
check "pgrep -f 'vite' > /dev/null" "Frontend Process Running"
check "lsof -i :3000 | grep LISTEN > /dev/null" "Backend Listening on Port 3000"
check "lsof -i :5173 | grep LISTEN > /dev/null" "Frontend Listening on Port 5173"
check "pg_isready -h localhost -p 5432 > /dev/null 2>&1" "PostgreSQL Connected"
check "redis-cli ping > /dev/null 2>&1" "Redis Connected"
echo ""

echo "=========================================="
echo "2. BACKEND API ENDPOINTS"
echo "=========================================="
check "curl -sf http://localhost:3000/api/v1/health > /dev/null" "Health Endpoint (200 OK)"
check "curl -sf http://localhost:3000/api/v1/health | grep -q 'OK'" "Health Check Returns OK"
check "curl -sf http://localhost:3000/api/docs > /dev/null" "API Documentation Accessible"
echo ""

echo "=========================================="
echo "3. DATABASE OPERATIONS"
echo "=========================================="
check "redis-cli SET test_key 'test_value' > /dev/null 2>&1" "Redis WRITE Operation"
check "redis-cli GET test_key | grep -q 'test_value'" "Redis READ Operation"
check "redis-cli DEL test_key > /dev/null 2>&1" "Redis DELETE Operation"
echo ""

echo "=========================================="
echo "4. BACKEND MODULE FILES"
echo "=========================================="
BACKEND_DIR="/home/appjobs/Desktop/Viralfx/Viral Fx 1/backend/src/modules"
check "[ -d $BACKEND_DIR/auth ]" "Auth Module Exists"
check "[ -d $BACKEND_DIR/admin ]" "Admin Module Exists"
check "[ -d $BACKEND_DIR/wallet ]" "Wallet Module Exists"
check "[ -d $BACKEND_DIR/brokers ]" "Brokers Module Exists"
check "[ -d $BACKEND_DIR/crm ]" "CRM Module Exists"
check "[ -d $BACKEND_DIR/vpmx ]" "VPMX Module Exists"
check "[ -d $BACKEND_DIR/analytics ]" "Analytics Module Exists"
check "[ -d $BACKEND_DIR/notifications ]" "Notifications Module Exists"
check "[ -d $BACKEND_DIR/market-aggregation ]" "Market Aggregation Module Exists"
check "[ -d $BACKEND_DIR/websocket ]" "WebSocket Module Exists"
echo ""

echo "=========================================="
echo "5. FRONTEND PAGES"
echo "=========================================="
FRONTEND_DIR="/home/appjobs/Desktop/Viralfx/Viral Fx 1/frontend/src/pages"
check "[ -f $FRONTEND_DIR/Login.tsx ]" "Login Page Exists"
check "[ -f $FRONTEND_DIR/Register.tsx ]" "Register Page Exists"
check "[ -f $FRONTEND_DIR/Home.tsx ]" "Home Page Exists"
check "[ -f $FRONTEND_DIR/dashboard/UserDashboard.tsx ]" "User Dashboard Exists"
check "[ -f $FRONTEND_DIR/dashboard/AdminDashboard.tsx ]" "Admin Dashboard Exists"
check "[ -f $FRONTEND_DIR/BrokerDashboard.tsx ]" "Broker Dashboard Exists"
check "[ -f $FRONTEND_DIR/TradingDashboard.tsx ]" "Trading Dashboard Exists"
check "[ -f $FRONTEND_DIR/wallet/DepositPage.tsx ]" "Deposit Page Exists"
echo ""

echo "=========================================="
echo "6. FRONTEND COMPONENTS"
echo "=========================================="
COMPONENTS_DIR="/home/appjobs/Desktop/Viralfx/Viral Fx 1/frontend/src/components"
check "[ -d $COMPONENTS/trading ]" "Trading Components Directory"
check "[ -d $COMPONENTS/wallet ]" "Wallet Components Directory"
check "[ -d $COMPONENTS/layout ]" "Layout Components Directory"
echo ""

echo "=========================================="
echo "7. CONFIGURATION FILES"
echo "=========================================="
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/backend/.env ]" "Backend .env Exists"
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/frontend/.env ]" "Frontend .env Exists"
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/backend/prisma/schema.prisma ]" "Prisma Schema Exists"
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/frontend/tailwind.config.js ]" "Tailwind Config Exists"
echo ""

echo "=========================================="
echo "8. LOG FILES"
echo "=========================================="
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/backend/logs/backend.log ]" "Backend Log File Exists"
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/frontend/logs/frontend.log ]" "Frontend Log File Exists"
echo ""

echo "=========================================="
echo "9. DOCUMENTATION"
echo "=========================================="
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/COMPREHENSIVE_STATUS_REPORT.md ]" "Status Report Exists"
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/QUICK_START_GUIDE.md ]" "Quick Start Guide Exists"
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/PAYMENT_SETUP_GUIDE.md ]" "Payment Setup Guide Exists"
check "[ -f /home/appjobs/Desktop/Viralfx/Viral Fx 1/UI_IMPROVEMENTS_GUIDE.md ]" "UI Improvements Guide Exists"
echo ""

echo "=========================================="
echo "10. BACKEND RECENT LOGS (Last 5 errors)"
echo "=========================================="
BACKEND_LOG="/home/appjobs/Desktop/Viralfx/Viral Fx 1/backend/logs/backend.log"
if [ -f "$BACKEND_LOG" ]; then
    ERROR_COUNT=$(grep -i "error" "$BACKEND_LOG" 2>/dev/null | tail -10 | wc -l)
    if [ $ERROR_COUNT -eq 0 ]; then
        echo -e "${GREEN}✓${NC} No errors in recent logs"
    else
        echo -e "${YELLOW}⚠${NC} Found $ERROR_COUNT recent error entries"
        echo "Last 5 errors:"
        grep -i "error" "$BACKEND_LOG" 2>/dev/null | tail -5
    fi
else
    echo -e "${YELLOW}⚠${NC} Backend log file not found"
fi
echo ""

echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="
echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "ALL SYSTEMS OPERATIONAL ✅"
    echo "==========================================${NC}"
    exit 0
else
    echo -e "${RED}=========================================="
    echo "SOME CHECKS FAILED ⚠️"
    echo "==========================================${NC}"
    exit 1
fi
