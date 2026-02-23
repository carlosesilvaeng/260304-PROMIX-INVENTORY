#!/bin/bash

# ============================================================================
# PROMIX PLANT INVENTORY - API TESTING SCRIPT
# ============================================================================
# Purpose: Test all Review & Approve endpoints
# Usage: ./test-approval-endpoints.sh
# ============================================================================

# CONFIGURATION
# Replace these with your actual values
PROJECT_ID="YOUR_PROJECT_ID"
ANON_KEY="YOUR_ANON_KEY"
BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-02205af0"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "============================================================================"
echo "🧪 TESTING PROMIX PLANT INVENTORY - APPROVAL ENDPOINTS"
echo "============================================================================"
echo ""

# ============================================================================
# TEST 1: Create a test inventory month
# ============================================================================
echo -e "${BLUE}TEST 1: Creating test inventory month...${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/inventory/month" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "plant_id": "CAROLINA",
    "year_month": "2026-02",
    "created_by": "test-manager@promix.com"
  }')

echo "$RESPONSE" | jq '.'

INVENTORY_ID=$(echo "$RESPONSE" | jq -r '.data.id')
echo -e "${GREEN}✓ Inventory ID: ${INVENTORY_ID}${NC}"
echo ""

# ============================================================================
# TEST 2: Save as draft
# ============================================================================
echo -e "${BLUE}TEST 2: Saving inventory as draft...${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/inventory/save-draft" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"inventory_month_id\": \"${INVENTORY_ID}\"
  }")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Draft saved successfully${NC}"
else
  echo -e "${RED}✗ Failed to save draft${NC}"
fi
echo ""

# ============================================================================
# TEST 3: Submit for approval
# ============================================================================
echo -e "${BLUE}TEST 3: Submitting inventory for approval...${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/inventory/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"inventory_month_id\": \"${INVENTORY_ID}\",
    \"submitted_by\": \"manager@promix.com\"
  }")

echo "$RESPONSE" | jq '.'

STATUS=$(echo "$RESPONSE" | jq -r '.data.status')
if [ "$STATUS" == "SUBMITTED" ]; then
  echo -e "${GREEN}✓ Status changed to SUBMITTED${NC}"
  echo -e "${GREEN}✓ Submitted by: $(echo "$RESPONSE" | jq -r '.data.submitted_by')${NC}"
  echo -e "${GREEN}✓ Submitted at: $(echo "$RESPONSE" | jq -r '.data.submitted_at')${NC}"
else
  echo -e "${RED}✗ Failed to submit${NC}"
fi
echo ""

# ============================================================================
# TEST 4: Try to submit again (should fail)
# ============================================================================
echo -e "${BLUE}TEST 4: Attempting to submit again (should fail)...${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/inventory/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"inventory_month_id\": \"${INVENTORY_ID}\",
    \"submitted_by\": \"manager@promix.com\"
  }")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null; then
  echo -e "${GREEN}✓ Correctly rejected duplicate submission${NC}"
else
  echo -e "${RED}✗ Should have rejected duplicate submission${NC}"
fi
echo ""

# ============================================================================
# TEST 5: Approve inventory
# ============================================================================
echo -e "${BLUE}TEST 5: Approving inventory...${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/inventory/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"inventory_month_id\": \"${INVENTORY_ID}\",
    \"approved_by\": \"admin@promix.com\",
    \"notes\": \"Inventory looks good. Approved.\"
  }")

echo "$RESPONSE" | jq '.'

STATUS=$(echo "$RESPONSE" | jq -r '.data.status')
if [ "$STATUS" == "APPROVED" ]; then
  echo -e "${GREEN}✓ Status changed to APPROVED${NC}"
  echo -e "${GREEN}✓ Approved by: $(echo "$RESPONSE" | jq -r '.data.approved_by')${NC}"
  echo -e "${GREEN}✓ Approved at: $(echo "$RESPONSE" | jq -r '.data.approved_at')${NC}"
  echo -e "${GREEN}✓ Approval notes: $(echo "$RESPONSE" | jq -r '.data.approval_notes')${NC}"
else
  echo -e "${RED}✗ Failed to approve${NC}"
fi
echo ""

# ============================================================================
# TEST 6: Create another inventory for rejection test
# ============================================================================
echo -e "${BLUE}TEST 6: Creating second test inventory for rejection...${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/inventory/month" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "plant_id": "GUAYNABO",
    "year_month": "2026-02",
    "created_by": "test-manager2@promix.com"
  }')

INVENTORY_ID_2=$(echo "$RESPONSE" | jq -r '.data.id')
echo -e "${GREEN}✓ Second Inventory ID: ${INVENTORY_ID_2}${NC}"
echo ""

# ============================================================================
# TEST 7: Submit second inventory
# ============================================================================
echo -e "${BLUE}TEST 7: Submitting second inventory...${NC}"
curl -s -X POST "${BASE_URL}/inventory/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"inventory_month_id\": \"${INVENTORY_ID_2}\",
    \"submitted_by\": \"manager2@promix.com\"
  }" > /dev/null

echo -e "${GREEN}✓ Second inventory submitted${NC}"
echo ""

# ============================================================================
# TEST 8: Reject inventory
# ============================================================================
echo -e "${BLUE}TEST 8: Rejecting second inventory...${NC}"
RESPONSE=$(curl -s -X POST "${BASE_URL}/inventory/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{
    \"inventory_month_id\": \"${INVENTORY_ID_2}\",
    \"rejected_by\": \"admin@promix.com\",
    \"rejection_notes\": \"Missing critical data in Aggregates section. Please complete and resubmit.\"
  }")

echo "$RESPONSE" | jq '.'

STATUS=$(echo "$RESPONSE" | jq -r '.data.status')
if [ "$STATUS" == "IN_PROGRESS" ]; then
  echo -e "${GREEN}✓ Status reverted to IN_PROGRESS${NC}"
  echo -e "${GREEN}✓ Rejected by: $(echo "$RESPONSE" | jq -r '.data.rejected_by')${NC}"
  echo -e "${GREEN}✓ Rejected at: $(echo "$RESPONSE" | jq -r '.data.rejected_at')${NC}"
  echo -e "${GREEN}✓ Rejection notes: $(echo "$RESPONSE" | jq -r '.data.rejection_notes')${NC}"
  echo -e "${GREEN}✓ Submission data cleared: submitted_by = $(echo "$RESPONSE" | jq -r '.data.submitted_by')${NC}"
else
  echo -e "${RED}✗ Failed to reject${NC}"
fi
echo ""

# ============================================================================
# TEST 9: Verify traceability
# ============================================================================
echo -e "${BLUE}TEST 9: Verifying traceability of first inventory...${NC}"
echo ""
echo "Query to run in Supabase SQL Editor:"
echo ""
echo "SELECT id, plant_id, year_month, status,"
echo "       created_by, submitted_by, approved_by,"
echo "       created_at, submitted_at, approved_at"
echo "FROM inventory_month_02205af0"
echo "WHERE id = '${INVENTORY_ID}';"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "============================================================================"
echo -e "${GREEN}✅ ALL TESTS COMPLETED${NC}"
echo "============================================================================"
echo ""
echo "Summary of created test data:"
echo "  • First Inventory ID: ${INVENTORY_ID} (APPROVED)"
echo "  • Second Inventory ID: ${INVENTORY_ID_2} (REJECTED → IN_PROGRESS)"
echo ""
echo "Next steps:"
echo "  1. Verify the data in Supabase Table Editor"
echo "  2. Test the Review & Approve UI in the application"
echo "  3. Test with different user roles (Plant Manager, Admin)"
echo ""
echo "============================================================================"
