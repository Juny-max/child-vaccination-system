#!/bin/bash
# Testing Setup Script for HQ Dashboard
# This script sets up test data and generates auth tokens

echo "🚀 HQ Dashboard Testing Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# 1. GENERATE TEST JWT TOKEN
# ============================================================
echo -e "\n${BLUE}📋 Step 1: Generating Test JWT Token${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

JWT_SECRET="${JWT_SECRET:-super-secret-key}"

# Create a Node.js script to generate JWT inline
cat > /tmp/generate-jwt.js << 'ENDSCRIPT'
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function hmac(message, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const header = { alg: 'HS256', typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const payload = {
  userId: 'test-admin-001',
  email: 'admin@health.gov.gh',
  role: 'hq-admin',
  name: 'Test Administrator',
  permissions: ['create_user', 'edit_user', 'delete_user', 'manage_branches', 'view_analytics', 'trigger_backup'],
  iat: now,
  exp: now + 86400, // 24 hours
};

const headerEncoded = base64url(JSON.stringify(header));
const payloadEncoded = base64url(JSON.stringify(payload));
const signature = hmac(`${headerEncoded}.${payloadEncoded}`, process.argv[1]);
const token = `${headerEncoded}.${payloadEncoded}.${signature}`;

console.log(token);
ENDSCRIPT

TOKEN=$(node /tmp/generate-jwt.js "$JWT_SECRET")

echo -e "${GREEN}✅ JWT Token Generated${NC}"
echo -e "${YELLOW}Token:${NC} $TOKEN"

# ============================================================
# 2. CREATE TEST DATA FILE
# ============================================================
echo -e "\n${BLUE}📊 Step 2: Creating Test Data Seed${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > /tmp/hq-test-data.json << 'ENDDATA'
{
  "users": [
    {
      "id": "USR-001",
      "name": "Akua Aidoo",
      "email": "akua.aidoo@health.gov.gh",
      "role": "hq-admin",
      "status": "active"
    },
    {
      "id": "USR-002",
      "name": "Kofi Antwi",
      "email": "kofi.antwi@health.gov.gh",
      "role": "data-officer",
      "branch": "Accra Central",
      "status": "active"
    },
    {
      "id": "USR-003",
      "name": "Ama Adjei",
      "email": "ama.adjei@health.gov.gh",
      "role": "branch-manager",
      "branch": "Tamale Teaching Hospital",
      "status": "active"
    }
  ],
  "branches": [
    {
      "id": "BR-001",
      "name": "Accra Central Hospital",
      "code": "ACCH",
      "region": "Greater Accra",
      "manager": "Yaa Boakye",
      "status": "active",
      "assignedChws": 5,
      "catchmentAreas": 3
    },
    {
      "id": "BR-002",
      "name": "Tamale Teaching Hospital",
      "code": "TTH",
      "region": "Northern",
      "manager": "Haruna Yakubu",
      "status": "active",
      "assignedChws": 4,
      "catchmentAreas": 2
    },
    {
      "id": "BR-003",
      "name": "Kumasi Polyclinic",
      "code": "KPC",
      "region": "Ashanti",
      "manager": "Samuel Mensah",
      "status": "active",
      "assignedChws": 6,
      "catchmentAreas": 4
    }
  ],
  "vaccines": [
    {
      "id": "VAC-001",
      "code": "BCG",
      "name": "Bacillus Calmette-Guerin",
      "schedule": "At birth",
      "dueDays": 0,
      "status": "active"
    },
    {
      "id": "VAC-002",
      "code": "OPV1",
      "name": "Oral Polio Vaccine - Dose 1",
      "schedule": "6 weeks",
      "dueDays": 42,
      "status": "active"
    },
    {
      "id": "VAC-003",
      "code": "DPT3",
      "name": "Diphtheria, Pertussis, Tetanus - Dose 3",
      "schedule": "14 weeks",
      "dueDays": 98,
      "status": "active"
    },
    {
      "id": "VAC-004",
      "code": "MMR",
      "name": "Measles, Mumps, Rubella",
      "schedule": "9 months",
      "dueDays": 273,
      "status": "active"
    }
  ],
  "system_status": [
    {
      "id": "db",
      "name": "Database",
      "status": "operational",
      "detail": "Primary cluster healthy · last backup 3h ago"
    },
    {
      "id": "api",
      "name": "API Gateway",
      "status": "operational",
      "detail": "All endpoints responding · avg latency 45ms"
    },
    {
      "id": "queue",
      "name": "Job Queue",
      "status": "operational",
      "detail": "Processing normally · 234 pending jobs"
    }
  ]
}
ENDDATA

echo -e "${GREEN}✅ Test Data Created${NC}"
echo -e "${YELLOW}File:${NC} /tmp/hq-test-data.json"

# ============================================================
# 3. DISPLAY TESTING INSTRUCTIONS
# ============================================================
echo -e "\n${BLUE}🧪 Step 3: Testing Instructions${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "\n${GREEN}✨ Testing Setup Complete!${NC}\n"

echo -e "${YELLOW}1. Browser Testing - Dashboard${NC}"
echo "   URL: http://localhost:3000/hq/dashboard"
echo "   Action: Open in browser and check console (F12)"
echo ""

echo -e "${YELLOW}2. Store JWT Token in Browser${NC}"
echo "   Open browser console (F12) and run:"
echo ""
echo "   localStorage.setItem('accessToken', '$TOKEN');"
echo ""

echo -e "${YELLOW}3. Test API Endpoints${NC}"
echo "   System Metrics:"
echo "   curl -H \"Authorization: Bearer $TOKEN\" \\"
echo "     http://localhost:3001/api/hq-admin/system/metrics"
echo ""
echo "   Branches:"
echo "   curl -H \"Authorization: Bearer $TOKEN\" \\"
echo "     http://localhost:3001/api/hq-admin/branches"
echo ""
echo "   Users:"
echo "   curl -H \"Authorization: Bearer $TOKEN\" \\"
echo "     http://localhost:3001/api/hq-admin/users"
echo ""

echo -e "${YELLOW}4. Expected Results${NC}"
echo "   ✅ Dashboard loads with real data from APIs"
echo "   ✅ No mock data displayed"
echo "   ✅ System metrics update in real-time"
echo "   ✅ User list populated from backend"
echo "   ✅ Branch data visible"
echo ""

echo -e "${YELLOW}5. Verify in Browser Console${NC}"
echo "   Look for successful API responses:"
echo "   - GET /hq-admin/system/metrics → 200 OK"
echo "   - GET /hq-admin/branches → 200 OK"
echo "   - GET /hq-admin/users → 200 OK"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Ready to test! Visit http://localhost:3000${NC}\n"
