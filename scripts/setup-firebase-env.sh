#!/bin/bash
# scripts/setup-firebase-env.sh
# Quick setup script for Firebase service account

set -e  # Exit on error

echo ""
echo "🔧 Firebase Service Account Setup"
echo "=================================="
echo ""

# Check if firebase-service-account.json exists in Desktop
DESKTOP_FILE="$HOME/Desktop/firebase-service-account.json"
PROJECT_FILE="./firebase-service-account.json"

if [ -f "$DESKTOP_FILE" ]; then
  echo "✅ Found firebase-service-account.json on Desktop"
  
  # Copy to project root
  cp "$DESKTOP_FILE" "$PROJECT_FILE"
  echo "✅ Copied to project root"
  
elif [ -f "$PROJECT_FILE" ]; then
  echo "✅ Found firebase-service-account.json in project root"
  
else
  echo "❌ Error: firebase-service-account.json not found"
  echo ""
  echo "Please download it from:"
  echo "https://console.firebase.google.com/"
  echo "→ psots-society-25899"
  echo "→ Settings → Service accounts → Generate new private key"
  echo ""
  echo "Save it to:"
  echo "  $DESKTOP_FILE"
  echo "  OR"
  echo "  $PROJECT_FILE"
  echo ""
  exit 1
fi

# Validate JSON
if ! cat "$PROJECT_FILE" | python3 -m json.tool > /dev/null 2>&1; then
  echo "❌ Error: Invalid JSON file"
  exit 1
fi

echo "✅ Valid JSON file"

# Export environment variable
export FIREBASE_SERVICE_ACCOUNT=$(cat "$PROJECT_FILE")

# Check if it's set
if [ -z "$FIREBASE_SERVICE_ACCOUNT" ]; then
  echo "❌ Error: Failed to set environment variable"
  exit 1
fi

echo "✅ Environment variable set"
echo ""

# Add to shell profile for persistence
SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ]; then
  # Check if already exists
  if grep -q "FIREBASE_SERVICE_ACCOUNT" "$SHELL_RC"; then
    echo "⚠️  FIREBASE_SERVICE_ACCOUNT already in $SHELL_RC"
    echo "   (Skipping to avoid duplicates)"
  else
    echo "💾 Adding to $SHELL_RC for persistence..."
    echo "" >> "$SHELL_RC"
    echo "# Firebase service account for PSOTS migration" >> "$SHELL_RC"
    echo "export FIREBASE_SERVICE_ACCOUNT=\$(cat $PROJECT_FILE 2>/dev/null || echo '')" >> "$SHELL_RC"
    echo "✅ Added to $SHELL_RC"
    echo ""
    echo "💡 To use in new terminals, run:"
    echo "   source $SHELL_RC"
  fi
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Create D1 database:       npx wrangler d1 create psots-society-db"
echo "  2. Update wrangler.toml with database_id"
echo "  3. Deploy schema:            npx wrangler d1 execute psots-society-db --file=sql/psots-schema.sql --remote"
echo "  4. Export data:              npm run migrate:export"
echo "  5. Import data:              npm run migrate:import"
echo ""
