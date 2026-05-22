#!/bin/bash

# Convert lease agreement HTML files to PDF
# Requires Chrome/Chromium installed

echo "🔄 Converting lease agreements to PDF..."

# Check if Chrome is installed
if command -v "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" &> /dev/null; then
    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif command -v google-chrome &> /dev/null; then
    CHROME="google-chrome"
elif command -v chromium &> /dev/null; then
    CHROME="chromium"
else
    echo "❌ Chrome/Chromium not found. Please install Chrome or convert manually."
    echo ""
    echo "Manual steps:"
    echo "1. Open LEASE_AGREEMENT_TENANT1.html in browser"
    echo "2. Press Cmd+P (Mac) or Ctrl+P (Windows)"
    echo "3. Select 'Save as PDF'"
    echo "4. Save as LEASE_AGREEMENT_TENANT1.pdf"
    echo ""
    exit 1
fi

# Convert Tenant 1 lease
echo "Converting Tenant 1 lease agreement..."
"$CHROME" --headless --disable-gpu --print-to-pdf=LEASE_AGREEMENT_TENANT1.pdf \
    "file://$(pwd)/LEASE_AGREEMENT_TENANT1.html" 2>/dev/null

if [ -f "LEASE_AGREEMENT_TENANT1.pdf" ]; then
    echo "✅ Created: LEASE_AGREEMENT_TENANT1.pdf"
else
    echo "❌ Failed to create LEASE_AGREEMENT_TENANT1.pdf"
fi

# Convert Tenant 2 lease
echo "Converting Tenant 2 lease agreement..."
"$CHROME" --headless --disable-gpu --print-to-pdf=LEASE_AGREEMENT_TENANT2.pdf \
    "file://$(pwd)/LEASE_AGREEMENT_TENANT2.html" 2>/dev/null

if [ -f "LEASE_AGREEMENT_TENANT2.pdf" ]; then
    echo "✅ Created: LEASE_AGREEMENT_TENANT2.pdf"
else
    echo "❌ Failed to create LEASE_AGREEMENT_TENANT2.pdf"
fi

echo ""
echo "✅ Done! PDF files created in test-data folder."
echo ""
echo "Next steps:"
echo "1. Open TESTING_GUIDE.md"
echo "2. Follow Test Flow 3 to test tenant registration"
echo "3. Upload the PDF when prompted"
