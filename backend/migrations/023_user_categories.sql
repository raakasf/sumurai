-- User-defined custom categories
CREATE TABLE user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_categories_unique UNIQUE (user_id, name)
);

CREATE INDEX idx_user_categories_user_id ON user_categories(user_id);

ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_categories_user_isolation ON user_categories
    FOR ALL TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Per-transaction category overrides (stores the user's chosen category name)
CREATE TABLE transaction_category_overrides (
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (transaction_id, user_id)
);

CREATE INDEX idx_transaction_category_overrides_user_id ON transaction_category_overrides(user_id);

ALTER TABLE transaction_category_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_category_overrides_user_isolation ON transaction_category_overrides
    FOR ALL TO PUBLIC
    USING (user_id = current_setting('app.current_user_id', true)::uuid);
