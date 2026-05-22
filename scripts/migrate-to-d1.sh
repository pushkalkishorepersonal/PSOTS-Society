#!/bin/bash
#
# migrate-to-d1.sh
# Complete migration from Firestore to Cloudflare D1
#
# Usage:
#   ./scripts/migrate-to-d1.sh [local|remote]
#
# Steps:
#   1. Export Firestore data to JSON
#   2. Apply D1 schema
#   3. Import data to D1
#

set -e  # Exit on error

TARGET=${1:-local}  # Default to local if not specified

echo "=========================================="
echo "  PSOTS D1 Migration Script"
echo "=========================================="
echo ""
echo "Target: $TARGET"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "📋 Step 1: Checking prerequisites..."
echo ""

if [ ! -f "firebase-service-account.json" ] && [ -z "$FIREBASE_SERVICE_ACCOUNT" ]; then
  echo -e "${RED}❌ Error: Firebase service account not found${NC}"
  echo ""
  echo "Please either:"
  echo "  1. Place firebase-service-account.json in the project root, OR"
  echo "  2. Set FIREBASE_SERVICE_ACCOUNT environment variable"
  echo ""
  exit 1
fi

if [ "$TARGET" = "remote" ]; then
  echo -e "${YELLOW}⚠️  WARNING: You are about to migrate PRODUCTION data${NC}"
  echo ""
  read -p "Are you sure you want to continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
  fi
fi

echo -e "${GREEN}✅ Prerequisites checked${NC}"
echo ""

# Step 2: Export Firestore data
echo "📦 Step 2: Exporting Firestore data..."
echo ""

if [ -f "firebase-service-account.json" ]; then
  export FIREBASE_SERVICE_ACCOUNT=$(cat firebase-service-account.json)
fi

node scripts/export-firestore.js

echo ""
echo -e "${GREEN}✅ Firestore data exported${NC}"
echo ""

# Step 3: Apply D1 schema
echo "🗄️  Step 3: Applying D1 schema..."
echo ""

if [ "$TARGET" = "local" ]; then
  npx wrangler d1 execute psots-society-db --local --file=sql/psots-schema.sql
else
  npx wrangler d1 execute psots-society-db --remote --file=sql/psots-schema.sql
fi

echo ""
echo -e "${GREEN}✅ D1 schema applied${NC}"
echo ""

# Step 4: Import data to D1
echo "📥 Step 4: Importing data to D1..."
echo ""

if [ "$TARGET" = "local" ]; then
  node scripts/import-to-d1.js --local
else
  node scripts/import-to-d1.js --remote
fi

echo ""
echo -e "${GREEN}✅ Data imported to D1${NC}"
echo ""

# Step 5: Verification
echo "🔍 Step 5: Verifying migration..."
echo ""

if [ "$TARGET" = "local" ]; then
  echo "Checking resident count..."
  npx wrangler d1 execute psots-society-db --local --command "SELECT COUNT(*) as count FROM residents"
  
  echo ""
  echo "Checking credential count..."
  npx wrangler d1 execute psots-society-db --local --command "SELECT COUNT(*) as count FROM credentials"
else
  echo "Checking resident count..."
  npx wrangler d1 execute psots-society-db --remote --command "SELECT COUNT(*) as count FROM residents"
  
  echo ""
  echo "Checking credential count..."
  npx wrangler d1 execute psots-society-db --remote --command "SELECT COUNT(*) as count FROM credentials"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Migration Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Test the Worker locally: npx wrangler dev"
echo "  2. Test critical endpoints (login, flat check, etc.)"
echo "  3. If all tests pass, deploy to production"
echo ""
