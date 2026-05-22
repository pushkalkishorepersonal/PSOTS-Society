#!/bin/bash
# Test script for Chhath endpoints
# Usage: ./scripts/test-chhath-endpoints.sh [id_token] [admin_token]

set -e

API_BASE="https://telegram.psots.in"
ID_TOKEN="${1:-}"
ADMIN_TOKEN="${2:-}"

echo "🧪 Testing Chhath Endpoints"
echo "================================"
echo ""

# Test 1: Public GET /chhath/contributions
echo "1️⃣  GET /chhath/contributions (public read)"
echo "curl -s $API_BASE/chhath/contributions"
curl -s "$API_BASE/chhath/contributions" | jq .
echo ""

# Test 2: Public GET /chhath/volunteers
echo "2️⃣  GET /chhath/volunteers (public read)"
echo "curl -s $API_BASE/chhath/volunteers"
curl -s "$API_BASE/chhath/volunteers" | jq .
echo ""

if [ -z "$ID_TOKEN" ]; then
  echo "⚠️  ID token not provided. Skipping authenticated tests."
  echo "   Run: $0 'your-id-token' ['your-admin-token']"
  exit 0
fi

# Test 3: POST /chhath/contribute (requires auth)
echo "3️⃣  POST /chhath/contribute (authenticated)"
echo "curl -X POST $API_BASE/chhath/contribute \\"
echo "  -H 'Authorization: Bearer [ID_TOKEN]' \\"
echo "  -d '{\"amount\": 500, \"method\": \"upi\"}'"
curl -s -X POST "$API_BASE/chhath/contribute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"amount": 500, "method": "upi", "description": "Test contribution"}' | jq .
echo ""

# Test 4: POST /chhath/volunteer (requires auth)
echo "4️⃣  POST /chhath/volunteer (authenticated)"
echo "curl -X POST $API_BASE/chhath/volunteer \\"
echo "  -H 'Authorization: Bearer [ID_TOKEN]' \\"
echo "  -d '{\"role\": \"general\"}'"
curl -s -X POST "$API_BASE/chhath/volunteer" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"role": "general", "activities": ["helping"], "contactPhone": "+919482088904"}' | jq .
echo ""

if [ -z "$ADMIN_TOKEN" ]; then
  echo "⚠️  Admin token not provided. Skipping admin-only tests."
  echo "   Run: $0 'your-id-token' 'your-admin-token'"
  exit 0
fi

# Test 5: POST /chhath/announcement (admin only)
echo "5️⃣  POST /chhath/announcement (admin-only)"
echo "curl -X POST $API_BASE/chhath/announcement \\"
echo "  -H 'Authorization: Bearer [ADMIN_TOKEN]' \\"
echo "  -d '{\"title\": \"Test Announcement\", \"body\": \"Test body\"}'"
curl -s -X POST "$API_BASE/chhath/announcement" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"title": "Chhath Registration Open", "body": "Residents can now register as volunteers or make contributions.", "type": "event"}' | jq .
echo ""

echo "✅ All tests completed!"
