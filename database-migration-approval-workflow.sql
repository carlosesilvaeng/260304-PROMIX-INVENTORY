-- ============================================================================
-- MIGRATION SCRIPT: ADD SUBMISSION AND APPROVAL FIELDS
-- ============================================================================
-- Purpose: Add fields to inventory_month_02205af0 table to support
-- submission, approval, and rejection workflow with full traceability.
--
-- Execute this script in Supabase SQL Editor:
-- 1. Go to your Supabase project
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire script
-- 5. Click "Run" or press Ctrl+Enter
-- ============================================================================

-- Step 1: Add new columns to inventory_month_02205af0 table
-- ============================================================================

ALTER TABLE inventory_month_02205af0

-- Submission fields (when Plant Manager submits for approval)
ADD COLUMN IF NOT EXISTS submitted_by TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,

-- Approval fields (when Admin/Super Admin approves)
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approval_notes TEXT,

-- Rejection fields (when Admin/Super Admin rejects)
ADD COLUMN IF NOT EXISTS rejected_by TEXT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

-- Step 2: Add index for faster queries on status
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_month_status 
ON inventory_month_02205af0(status);

CREATE INDEX IF NOT EXISTS idx_inventory_month_plant_status 
ON inventory_month_02205af0(plant_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_month_year_month 
ON inventory_month_02205af0(year_month);

-- Step 3: Add comments to document the columns
-- ============================================================================

COMMENT ON COLUMN inventory_month_02205af0.status IS 
'Status of inventory: IN_PROGRESS, SUBMITTED, or APPROVED';

COMMENT ON COLUMN inventory_month_02205af0.created_by IS 
'User ID who created/filled the inventory (Plant Manager)';

COMMENT ON COLUMN inventory_month_02205af0.submitted_by IS 
'User ID who submitted the inventory for approval';

COMMENT ON COLUMN inventory_month_02205af0.submitted_at IS 
'Timestamp when inventory was submitted for approval';

COMMENT ON COLUMN inventory_month_02205af0.approved_by IS 
'User ID who approved the inventory (Admin/Super Admin)';

COMMENT ON COLUMN inventory_month_02205af0.approved_at IS 
'Timestamp when inventory was approved';

COMMENT ON COLUMN inventory_month_02205af0.approval_notes IS 
'Optional notes added by approver';

COMMENT ON COLUMN inventory_month_02205af0.rejected_by IS 
'User ID who rejected the inventory (Admin/Super Admin)';

COMMENT ON COLUMN inventory_month_02205af0.rejected_at IS 
'Timestamp when inventory was rejected';

COMMENT ON COLUMN inventory_month_02205af0.rejection_notes IS 
'Required notes explaining why inventory was rejected';

-- Step 4: Verify the changes
-- ============================================================================

-- Run this query to verify all columns exist:
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_month_02205af0'
ORDER BY ordinal_position;

-- Step 5: Test data integrity (optional)
-- ============================================================================

-- Check current records
SELECT 
    id,
    plant_id,
    year_month,
    status,
    created_by,
    submitted_by,
    approved_by,
    created_at,
    submitted_at,
    approved_at
FROM inventory_month_02205af0
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The inventory_month_02205af0 table now supports:
-- ✅ IN_PROGRESS status: Plant Manager filling out inventory
-- ✅ SUBMITTED status: Submitted for approval (read-only for PM)
-- ✅ APPROVED status: Approved by Admin/Super Admin (final)
-- ✅ Full traceability: Who created, who submitted, who approved
-- ✅ Rejection workflow: Admin can reject back to IN_PROGRESS
-- ============================================================================
