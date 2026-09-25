-- Migration 035: Add rollover_start_month to budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS rollover_start_month VARCHAR(7);

-- Populate rollover_start_month for existing rollover budgets with current month '2026-09'
UPDATE budgets 
SET rollover_start_month = TO_CHAR(COALESCE(updated_at, created_at, NOW()), 'YYYY-MM') 
WHERE rollover = true AND rollover_start_month IS NULL;

