-- Migration: Manual account balance history
-- Manual accounts do not have provider balance history, so record dated snapshots when users edit them.

CREATE TABLE IF NOT EXISTS manual_account_balance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,
    balance_current DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, as_of_date)
);

ALTER TABLE manual_account_balance_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'manual_account_balance_history'
          AND policyname = 'rls_user'
    ) THEN
        CREATE POLICY rls_user ON manual_account_balance_history
        USING (user_id::text = current_setting('app.current_user_id', true));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mabh_user_date
ON manual_account_balance_history(user_id, as_of_date);

CREATE INDEX IF NOT EXISTS idx_mabh_account_date
ON manual_account_balance_history(account_id, as_of_date);

INSERT INTO manual_account_balance_history (account_id, user_id, as_of_date, balance_current)
SELECT id, user_id, CURRENT_DATE, COALESCE(balance_current, 0)
FROM accounts
WHERE provider_connection_id IS NULL
  AND user_id IS NOT NULL
  AND account_type IN ('investment', 'property', 'real_estate', 'loan')
ON CONFLICT (account_id, as_of_date)
DO UPDATE SET balance_current = EXCLUDED.balance_current;
