-- Migration 033: Add frequency and rollover to budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS frequency VARCHAR(30) NOT NULL DEFAULT 'monthly';
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS rollover BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_budgets_frequency ON budgets(frequency);

