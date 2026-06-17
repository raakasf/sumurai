-- Soft-mark reviewed duplicate transactions so they can be excluded without
-- destroying the original provider payload.

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS duplicate_of_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS duplicate_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS duplicate_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_active_date
    ON transactions(user_id, date DESC, created_at DESC)
    WHERE duplicate_of_transaction_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_review
    ON transactions(user_id, duplicate_of_transaction_id)
    WHERE duplicate_of_transaction_id IS NOT NULL;
