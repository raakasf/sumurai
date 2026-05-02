-- Migration: Manual investment account tracking
-- Manual accounts do not have a provider connection, so store their institution name on the account row.

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS institution_name VARCHAR;

CREATE INDEX IF NOT EXISTS idx_accounts_manual_institution
ON accounts(user_id, institution_name)
WHERE provider_connection_id IS NULL;
