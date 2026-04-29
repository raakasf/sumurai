-- Glob-pattern rules: automatically assign a category to all transactions
-- whose merchant_name matches the pattern (case-insensitive, * and ? wildcards).
-- Priority: explicit transaction_category_overrides > rule match > provider category.
CREATE TABLE category_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    pattern VARCHAR(500) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT category_rules_unique UNIQUE (user_id, pattern)
);

CREATE INDEX idx_category_rules_user_id ON category_rules(user_id);

ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_rules_user_isolation ON category_rules
    FOR ALL TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);
