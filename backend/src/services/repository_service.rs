use crate::models::{
    account::Account,
    auth::User,
    budget::Budget,
    category::{CategoryRule, UserCategory},
    plaid::{LatestAccountBalance, PlaidCredentials, ProviderConnection},
    transaction::{Transaction, TransactionWithAccount},
};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use anyhow::Result;
use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

#[async_trait]
#[cfg_attr(test, mockall::automock)]
#[allow(dead_code)]
pub trait DatabaseRepository: Send + Sync {
    async fn create_user(&self, user: &User) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>>;
    async fn get_user_by_id(&self, user_id: &Uuid) -> Result<Option<User>>;
    async fn mark_onboarding_complete(&self, user_id: &Uuid) -> Result<()>;
    async fn update_user_provider(&self, user_id: &Uuid, provider: &str) -> Result<()>;

    async fn get_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>>;
    async fn get_transactions_with_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<TransactionWithAccount>>;
    async fn get_transactions_by_date_range_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<Transaction>>;
    async fn get_accounts_for_user(&self, user_id: &Uuid) -> Result<Vec<Account>>;
    async fn get_transaction_count_by_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashMap<Uuid, i64>>;

    async fn create_manual_account(&self, account: &Account) -> Result<Account>;
    async fn update_manual_account(&self, account: &Account) -> Result<Account>;
    async fn delete_manual_account(&self, account_id: Uuid, user_id: Uuid) -> Result<()>;
    async fn upsert_account(&self, account: &Account) -> Result<()>;
    async fn upsert_transaction(&self, transaction: &Transaction) -> Result<()>;

    async fn store_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
        access_token: &str,
    ) -> Result<Uuid>;

    async fn get_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
    ) -> Result<Option<PlaidCredentials>>;

    async fn save_provider_connection(&self, connection: &ProviderConnection) -> Result<()>;
    async fn get_all_provider_connections_by_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ProviderConnection>>;
    async fn get_provider_connection_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<ProviderConnection>>;
    async fn delete_provider_transactions(&self, item_id: &str) -> Result<i32>;
    async fn delete_provider_accounts(&self, item_id: &str) -> Result<i32>;
    async fn delete_provider_connection(&self, user_id: &Uuid, item_id: &str) -> Result<()>;
    async fn delete_provider_credentials(&self, item_id: &str) -> Result<()>;
    async fn get_budgets_for_user(&self, user_id: Uuid) -> Result<Vec<Budget>>;
    async fn create_budget_for_user(&self, budget: Budget) -> Result<Budget>;

    async fn update_budget_for_user(
        &self,
        budget_id: Uuid,
        user_id: Uuid,
        amount: rust_decimal::Decimal,
    ) -> Result<Budget>;

    async fn delete_budget_for_user(&self, budget_id: Uuid, user_id: Uuid) -> Result<()>;

    async fn get_latest_account_balances_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LatestAccountBalance>>;

    async fn update_user_password(&self, user_id: &Uuid, new_password_hash: &str) -> Result<()>;

    async fn delete_user(&self, user_id: &Uuid) -> Result<()>;

    async fn get_user_categories(&self, user_id: Uuid) -> Result<Vec<UserCategory>>;
    async fn create_user_category(&self, user_id: Uuid, name: String) -> Result<UserCategory>;
    async fn delete_user_category(&self, category_id: Uuid, user_id: Uuid) -> Result<()>;
    async fn set_transaction_category_override(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
        category_name: String,
    ) -> Result<()>;
    async fn remove_transaction_category_override(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
    ) -> Result<()>;

    async fn get_category_rules(&self, user_id: Uuid) -> Result<Vec<CategoryRule>>;
    async fn create_category_rule(
        &self,
        user_id: Uuid,
        pattern: String,
        category_name: String,
    ) -> Result<CategoryRule>;
    async fn update_category_rule(
        &self,
        rule_id: Uuid,
        user_id: Uuid,
        pattern: Option<String>,
        category_name: Option<String>,
    ) -> Result<CategoryRule>;
    async fn delete_category_rule(&self, rule_id: Uuid, user_id: Uuid) -> Result<()>;
}

pub struct PostgresRepository {
    pool: PgPool,
    encryption_key: [u8; 32],
}

impl PostgresRepository {
    pub fn new(pool: PgPool) -> Result<Self> {
        let key_str = std::env::var("ENCRYPTION_KEY").unwrap_or_else(|_| {
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()
        });

        let key_bytes =
            hex::decode(&key_str).map_err(|_| anyhow::anyhow!("Invalid encryption key format"))?;

        if key_bytes.len() != 32 {
            return Err(anyhow::anyhow!(
                "Encryption key must be 32 bytes (64 hex chars)"
            ));
        }

        let mut encryption_key = [0u8; 32];
        encryption_key.copy_from_slice(&key_bytes);

        Ok(Self {
            pool,
            encryption_key,
        })
    }

    fn encrypt_token(&self, token: &str) -> Result<Vec<u8>> {
        let key = Key::<Aes256Gcm>::from_slice(&self.encryption_key);
        let cipher = Aes256Gcm::new(key);

        let nonce_bytes: [u8; 12] = rand::random();
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, token.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    fn decrypt_token(&self, encrypted_data: &[u8]) -> Result<String> {
        if encrypted_data.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted data length"));
        }

        let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let key = Key::<Aes256Gcm>::from_slice(&self.encryption_key);
        let cipher = Aes256Gcm::new(key);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        String::from_utf8(plaintext)
            .map_err(|e| anyhow::anyhow!("Invalid UTF-8 in decrypted data: {}", e))
    }

    fn map_user_row(
        (id, email, password_hash, provider, created_at, updated_at, onboarding_completed): (
            uuid::Uuid,
            String,
            String,
            String,
            chrono::DateTime<chrono::Utc>,
            chrono::DateTime<chrono::Utc>,
            bool,
        ),
    ) -> User {
        User {
            id,
            email,
            password_hash,
            provider,
            created_at,
            updated_at,
            onboarding_completed,
        }
    }
}

#[async_trait]
impl DatabaseRepository for PostgresRepository {
    async fn create_user(&self, user: &User) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO users (id, email, password_hash, provider, created_at, updated_at, onboarding_completed)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(user.id)
        .bind(&user.email)
        .bind(&user.password_hash)
        .bind(&user.provider)
        .bind(user.created_at)
        .bind(user.updated_at)
        .bind(user.onboarding_completed)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>> {
        let row = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                String,
                String,
                String,
                chrono::DateTime<chrono::Utc>,
                chrono::DateTime<chrono::Utc>,
                bool,
            ),
        >(
            "SELECT id, email, password_hash, provider, created_at, updated_at, onboarding_completed FROM users WHERE email = $1",
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Self::map_user_row))
    }

    async fn get_user_by_id(&self, user_id: &Uuid) -> Result<Option<User>> {
        let row = sqlx::query_as::<
            _,
            (
                uuid::Uuid,
                String,
                String,
                String,
                chrono::DateTime<chrono::Utc>,
                chrono::DateTime<chrono::Utc>,
                bool,
            ),
        >(
            "SELECT id, email, password_hash, provider, created_at, updated_at, onboarding_completed FROM users WHERE id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Self::map_user_row))
    }

    async fn mark_onboarding_complete(&self, user_id: &Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET onboarding_completed = true, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_user_provider(&self, user_id: &Uuid, provider: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET provider = $2, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .bind(provider)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn upsert_account(&self, account: &Account) -> Result<()> {
        // Ensure RLS permits this write by setting current user id (if provided)
        let mut tx = self.pool.begin().await?;
        if let Some(user_id) = account.user_id {
            sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
                .bind(user_id.to_string())
                .execute(&mut *tx)
                .await?;
        }
        sqlx::query(
            r#"
            INSERT INTO accounts (id, user_id, provider_account_id, provider_connection_id, name, account_type, balance_current, mask, institution_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (provider_account_id) 
            DO UPDATE SET 
                provider_connection_id = EXCLUDED.provider_connection_id,
                name = EXCLUDED.name,
                account_type = EXCLUDED.account_type,
                balance_current = EXCLUDED.balance_current,
                mask = EXCLUDED.mask,
                institution_name = EXCLUDED.institution_name
            "#
        )
        .bind(account.id)
        .bind(account.user_id)
        .bind(&account.provider_account_id)
        .bind(account.provider_connection_id)
        .bind(&account.name)
        .bind(&account.account_type)
        .bind(account.balance_current)
        .bind(&account.mask)
        .bind(&account.institution_name)
        .execute(&mut *tx)
            .await?;
        tx.commit().await?;

        Ok(())
    }

    async fn create_manual_account(&self, account: &Account) -> Result<Account> {
        let mut tx = self.pool.begin().await?;
        if let Some(user_id) = account.user_id {
            sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
                .bind(user_id.to_string())
                .execute(&mut *tx)
                .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO accounts (
                id, user_id, provider_account_id, provider_connection_id,
                name, account_type, balance_current, mask, institution_name
            )
            VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(account.id)
        .bind(account.user_id)
        .bind(&account.name)
        .bind(&account.account_type)
        .bind(account.balance_current)
        .bind(&account.mask)
        .bind(&account.institution_name)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(account.clone())
    }

    async fn update_manual_account(&self, account: &Account) -> Result<Account> {
        let user_id = account
            .user_id
            .ok_or_else(|| anyhow::anyhow!("Manual account update requires a user id"))?;
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let result = sqlx::query(
            r#"
            UPDATE accounts
            SET name = $1,
                balance_current = $2,
                mask = $3,
                institution_name = $4,
                updated_at = NOW()
            WHERE id = $5
              AND user_id = $6
              AND provider_connection_id IS NULL
              AND account_type = 'investment'
            "#,
        )
        .bind(&account.name)
        .bind(account.balance_current)
        .bind(&account.mask)
        .bind(&account.institution_name)
        .bind(account.id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() == 0 {
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!("Manual investment account not found"));
        }

        tx.commit().await?;
        Ok(account.clone())
    }

    async fn delete_manual_account(&self, account_id: Uuid, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let result = sqlx::query(
            r#"
            DELETE FROM accounts
            WHERE id = $1
              AND user_id = $2
              AND provider_connection_id IS NULL
              AND account_type = 'investment'
            "#,
        )
        .bind(account_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() == 0 {
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!("Manual investment account not found"));
        }

        tx.commit().await?;
        Ok(())
    }

    async fn upsert_transaction(&self, transaction: &Transaction) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        if let Some(user_id) = transaction.user_id {
            sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
                .bind(user_id.to_string())
                .execute(&mut *tx)
                .await?;
        }

        sqlx::query(
            r#"
            INSERT INTO transactions (
                id, account_id, user_id, provider_transaction_id, amount, date,
                merchant_name, category_primary, category_detailed,
                category_confidence, payment_channel, pending, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (provider_transaction_id)
            DO UPDATE SET
                amount = EXCLUDED.amount,
                merchant_name = EXCLUDED.merchant_name,
                pending = EXCLUDED.pending
            "#,
        )
        .bind(transaction.id)
        .bind(transaction.account_id)
        .bind(transaction.user_id)
        .bind(&transaction.provider_transaction_id)
        .bind(transaction.amount)
        .bind(transaction.date)
        .bind(&transaction.merchant_name)
        .bind(&transaction.category_primary)
        .bind(&transaction.category_detailed)
        .bind(&transaction.category_confidence)
        .bind(&transaction.payment_channel)
        .bind(transaction.pending)
        .bind(transaction.created_at.unwrap_or_else(chrono::Utc::now))
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }

    async fn store_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
        access_token: &str,
    ) -> Result<Uuid> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let id = Uuid::new_v4();
        let encrypted_token = self.encrypt_token(access_token)?;

        sqlx::query(
            r#"
            INSERT INTO plaid_credentials (id, user_id, item_id, encrypted_access_token)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (item_id)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                encrypted_access_token = EXCLUDED.encrypted_access_token,
                updated_at = NOW()
            "#,
        )
        .bind(id)
        .bind(user_id)
        .bind(item_id)
        .bind(&encrypted_token)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(id)
    }

    async fn get_provider_credentials_for_user(
        &self,
        user_id: &Uuid,
        item_id: &str,
    ) -> Result<Option<PlaidCredentials>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let row = sqlx::query_as::<_, (Uuid, String, Vec<u8>, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>)>(
            "SELECT id, item_id, encrypted_access_token, created_at, updated_at FROM plaid_credentials WHERE item_id = $1"
        )
        .bind(item_id)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;

        if let Some((id, item_id, encrypted_access_token, created_at, updated_at)) = row {
            let access_token = self.decrypt_token(&encrypted_access_token)?;
            Ok(Some(PlaidCredentials {
                id,
                item_id,
                user_id: Some(*user_id),
                access_token,
                created_at,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    async fn save_provider_connection(&self, connection: &ProviderConnection) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(connection.user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            r#"
            INSERT INTO provider_connections (
                id, user_id, item_id, is_connected, last_sync_at, connected_at,
                disconnected_at, institution_id, institution_name, transaction_count, account_count,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (item_id)
            DO UPDATE SET
                is_connected = EXCLUDED.is_connected,
                last_sync_at = EXCLUDED.last_sync_at,
                connected_at = EXCLUDED.connected_at,
                disconnected_at = EXCLUDED.disconnected_at,
                institution_id = EXCLUDED.institution_id,
                institution_name = EXCLUDED.institution_name,
                transaction_count = EXCLUDED.transaction_count,
                account_count = EXCLUDED.account_count,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(connection.id)
        .bind(connection.user_id)
        .bind(&connection.item_id)
        .bind(connection.is_connected)
        .bind(connection.last_sync_at)
        .bind(connection.connected_at)
        .bind(connection.disconnected_at)
        .bind(&connection.institution_id)
        .bind(&connection.institution_name)
        .bind(connection.transaction_count)
        .bind(connection.account_count)
        .bind(connection.created_at)
        .bind(connection.updated_at)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }

    async fn get_all_provider_connections_by_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ProviderConnection>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                String,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                i32,
                i32,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
                   disconnected_at, institution_id, institution_name, institution_logo_url,
                   sync_cursor, transaction_count, account_count, created_at, updated_at
            FROM provider_connections
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    user_id,
                    item_id,
                    is_connected,
                    last_sync_at,
                    connected_at,
                    disconnected_at,
                    institution_id,
                    institution_name,
                    institution_logo_url,
                    sync_cursor,
                    transaction_count,
                    account_count,
                    created_at,
                    updated_at,
                )| ProviderConnection {
                    id,
                    user_id,
                    item_id,
                    is_connected,
                    last_sync_at,
                    connected_at,
                    disconnected_at,
                    institution_id,
                    institution_name,
                    institution_logo_url,
                    sync_cursor,
                    transaction_count,
                    account_count,
                    created_at,
                    updated_at,
                },
            )
            .collect())
    }

    async fn get_provider_connection_by_id(
        &self,
        connection_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<ProviderConnection>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let row = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                String,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                i32,
                i32,
                Option<chrono::DateTime<chrono::Utc>>,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, user_id, item_id, is_connected, last_sync_at, connected_at,
                   disconnected_at, institution_id, institution_name, institution_logo_url,
                   sync_cursor, transaction_count, account_count, created_at, updated_at
            FROM provider_connections
            WHERE id = $1
            "#,
        )
        .bind(connection_id)
        .fetch_optional(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(row.map(
            |(
                id,
                user_id,
                item_id,
                is_connected,
                last_sync_at,
                connected_at,
                disconnected_at,
                institution_id,
                institution_name,
                institution_logo_url,
                sync_cursor,
                transaction_count,
                account_count,
                created_at,
                updated_at,
            )| ProviderConnection {
                id,
                user_id,
                item_id,
                is_connected,
                last_sync_at,
                connected_at,
                disconnected_at,
                institution_id,
                institution_name,
                institution_logo_url,
                sync_cursor,
                transaction_count,
                account_count,
                created_at,
                updated_at,
            },
        ))
    }

    async fn delete_provider_transactions(&self, item_id: &str) -> Result<i32> {
        let connection_id: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM provider_connections WHERE item_id = $1")
                .bind(item_id)
                .fetch_optional(&self.pool)
                .await?;

        let Some(conn_id) = connection_id else {
            return Ok(0);
        };

        let result = sqlx::query(
            r#"
            DELETE FROM transactions
            WHERE account_id IN (
                SELECT id FROM accounts WHERE provider_connection_id = $1
            )
            "#,
        )
        .bind(conn_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() as i32)
    }

    async fn delete_provider_accounts(&self, item_id: &str) -> Result<i32> {
        let connection_id: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM provider_connections WHERE item_id = $1")
                .bind(item_id)
                .fetch_optional(&self.pool)
                .await?;

        let Some(conn_id) = connection_id else {
            return Ok(0);
        };

        let result = sqlx::query("DELETE FROM accounts WHERE provider_connection_id = $1")
            .bind(conn_id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() as i32)
    }

    async fn delete_provider_connection(&self, user_id: &Uuid, item_id: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM provider_connections WHERE user_id = $1 AND item_id = $2")
            .bind(user_id)
            .bind(item_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn delete_provider_credentials(&self, item_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM plaid_credentials WHERE item_id = $1")
            .bind(item_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn get_transactions_for_user(&self, user_id: &Uuid) -> Result<Vec<Transaction>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                Option<Uuid>,
                Option<String>,
                rust_decimal::Decimal,
                chrono::NaiveDate,
                Option<String>,
                String,
                String,
                String,
                Option<String>,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, account_id, user_id, provider_transaction_id, amount, date,
                   merchant_name, category_primary, category_detailed,
                   category_confidence, payment_channel, pending, created_at
            FROM transactions 
            WHERE user_id = $1
            ORDER BY date DESC, created_at DESC
            LIMIT 1000
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    account_id,
                    user_id,
                    provider_transaction_id,
                    amount,
                    date,
                    merchant_name,
                    category_primary,
                    category_detailed,
                    category_confidence,
                    payment_channel,
                    pending,
                    created_at,
                )| Transaction {
                    id,
                    account_id,
                    user_id,
                    provider_account_id: None,
                    provider_transaction_id,
                    amount,
                    date,
                    merchant_name,
                    category_primary,
                    category_detailed,
                    category_confidence,
                    payment_channel,
                    pending,
                    created_at,
                },
            )
            .collect())
    }

    async fn get_transactions_with_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<TransactionWithAccount>> {
        // SQLx only implements FromRow for tuples up to 16 elements, so we use a
        // named struct to handle the 17-column result set.
        #[derive(sqlx::FromRow)]
        struct Row {
            id: Uuid,
            account_id: Uuid,
            user_id: Option<Uuid>,
            provider_transaction_id: Option<String>,
            amount: rust_decimal::Decimal,
            date: chrono::NaiveDate,
            merchant_name: Option<String>,
            category_primary: String,
            category_detailed: String,
            category_confidence: String,
            payment_channel: Option<String>,
            pending: bool,
            created_at: Option<chrono::DateTime<chrono::Utc>>,
            account_name: String,
            account_type: String,
            account_mask: Option<String>,
            custom_category: Option<String>,
        }

        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<_, Row>(
            r#"
            SELECT t.id, t.account_id, t.user_id, t.provider_transaction_id, t.amount, t.date,
                   t.merchant_name, t.category_primary, t.category_detailed,
                   t.category_confidence, t.payment_channel, t.pending, t.created_at,
                   a.name as account_name, a.account_type, a.mask as account_mask,
                   tco.category_name as custom_category
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN transaction_category_overrides tco
                ON t.id = tco.transaction_id AND tco.user_id = $1
            WHERE t.user_id = $1
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT 1000
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(|r| TransactionWithAccount {
                id: r.id,
                account_id: r.account_id,
                user_id: r.user_id,
                provider_account_id: None,
                provider_transaction_id: r.provider_transaction_id,
                amount: r.amount,
                date: r.date,
                merchant_name: r.merchant_name,
                category_primary: r.category_primary,
                category_detailed: r.category_detailed,
                category_confidence: r.category_confidence,
                payment_channel: r.payment_channel,
                pending: r.pending,
                created_at: r.created_at,
                account_name: r.account_name,
                account_type: r.account_type,
                account_mask: r.account_mask,
                custom_category: r.custom_category,
                rule_category: None, // populated by the handler after applying category rules
            })
            .collect())
    }

    async fn get_transactions_by_date_range_for_user(
        &self,
        user_id: &Uuid,
        start_date: chrono::NaiveDate,
        end_date: chrono::NaiveDate,
    ) -> Result<Vec<Transaction>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Uuid,
                Option<Uuid>,
                Option<String>,
                rust_decimal::Decimal,
                chrono::NaiveDate,
                Option<String>,
                String,
                String,
                String,
                Option<String>,
                bool,
                Option<chrono::DateTime<chrono::Utc>>,
            ),
        >(
            r#"
            SELECT id, account_id, user_id, provider_transaction_id, amount, date,
                   merchant_name, category_primary, category_detailed,
                   category_confidence, payment_channel, pending, created_at
            FROM transactions 
            WHERE user_id = $1 AND date >= $2 AND date <= $3
            ORDER BY date DESC, created_at DESC
            LIMIT 1000
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    account_id,
                    user_id,
                    provider_transaction_id,
                    amount,
                    date,
                    merchant_name,
                    category_primary,
                    category_detailed,
                    category_confidence,
                    payment_channel,
                    pending,
                    created_at,
                )| Transaction {
                    id,
                    account_id,
                    user_id,
                    provider_account_id: None,
                    provider_transaction_id,
                    amount,
                    date,
                    merchant_name,
                    category_primary,
                    category_detailed,
                    category_confidence,
                    payment_channel,
                    pending,
                    created_at,
                },
            )
            .collect())
    }

    async fn get_accounts_for_user(&self, user_id: &Uuid) -> Result<Vec<Account>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<
            _,
            (
                Uuid,
                Option<Uuid>,
                Option<String>,
                Option<Uuid>,
                String,
                String,
                Option<rust_decimal::Decimal>,
                Option<String>,
                Option<String>,
            ),
        >(
            r#"
            SELECT a.id, a.user_id, a.provider_account_id, a.provider_connection_id, a.name, a.account_type, a.balance_current, a.mask, COALESCE(a.institution_name, pc.institution_name) AS institution_name
            FROM accounts a
            LEFT JOIN provider_connections pc ON pc.id = a.provider_connection_id
            WHERE a.user_id = $1
            ORDER BY a.name
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    user_id,
                    provider_account_id,
                    provider_connection_id,
                    name,
                    account_type,
                    balance_current,
                    mask,
                    institution_name,
                )| Account {
                    id,
                    user_id,
                    provider_account_id,
                    provider_connection_id,
                    name,
                    account_type,
                    balance_current,
                    mask,
                    institution_name,
                },
            )
            .collect())
    }

    async fn get_transaction_count_by_account_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashMap<Uuid, i64>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rows = sqlx::query_as::<_, (Uuid, i64)>(
            r#"
            SELECT account_id, COUNT(*) as count
            FROM transactions 
            WHERE user_id = $1
            GROUP BY account_id
            "#,
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(rows.into_iter().collect())
    }

    async fn get_budgets_for_user(&self, user_id: Uuid) -> Result<Vec<Budget>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let budgets = sqlx::query_as::<_, Budget>(
            "SELECT id, user_id, category, amount, created_at, updated_at 
             FROM budgets 
             WHERE user_id = $1 
             ORDER BY category ASC",
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(budgets)
    }

    async fn create_budget_for_user(&self, budget: Budget) -> Result<Budget> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(budget.user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let res = sqlx::query(
            "INSERT INTO budgets (id, user_id, category, amount, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(budget.id)
        .bind(budget.user_id)
        .bind(&budget.category)
        .bind(budget.amount)
        .bind(budget.created_at)
        .bind(budget.updated_at)
        .execute(&mut *tx)
        .await;

        if let Err(e) = res {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    let _ = tx.rollback().await;
                    return Err(anyhow::anyhow!("Budget category already exists"));
                }
            }
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!(e));
        }

        tx.commit().await?;
        Ok(budget)
    }

    async fn update_budget_for_user(
        &self,
        budget_id: Uuid,
        user_id: Uuid,
        amount: rust_decimal::Decimal,
    ) -> Result<Budget> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let updated_at = chrono::Utc::now();

        sqlx::query(
            "UPDATE budgets SET amount = $1, updated_at = $2 
             WHERE id = $3 AND user_id = $4",
        )
        .bind(amount)
        .bind(updated_at)
        .bind(budget_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        let updated_budget = sqlx::query_as::<_, Budget>(
            "SELECT id, user_id, category, amount, created_at, updated_at 
             FROM budgets 
             WHERE id = $1 AND user_id = $2",
        )
        .bind(budget_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated_budget)
    }

    async fn delete_budget_for_user(&self, budget_id: Uuid, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM budgets WHERE id = $1 AND user_id = $2")
            .bind(budget_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_latest_account_balances_for_user(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LatestAccountBalance>> {
        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&self.pool)
            .await?;

        let rows = sqlx::query_as::<_, LatestAccountBalance>(
            r#"
            SELECT
                a.id AS account_id,
                COALESCE(a.institution_name, pc.institution_name, 'unknown_institution') AS institution_id,
                a.account_type,
                NULL::text AS account_subtype,
                'USD'::text AS currency,
                COALESCE(a.balance_current, 0) AS current_balance,
                a.provider_connection_id,
                COALESCE(a.institution_name, pc.institution_name) AS institution_name
            FROM accounts a
            LEFT JOIN provider_connections pc ON pc.id = a.provider_connection_id
            WHERE a.user_id = $1
            ORDER BY a.name
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn update_user_password(&self, user_id: &Uuid, new_password_hash: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2")
            .bind(new_password_hash)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn delete_user(&self, user_id: &Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_user_categories(&self, user_id: Uuid) -> Result<Vec<UserCategory>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let categories = sqlx::query_as::<_, UserCategory>(
            "SELECT id, user_id, name, created_at
             FROM user_categories
             WHERE user_id = $1
             ORDER BY name ASC",
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(categories)
    }

    async fn create_user_category(&self, user_id: Uuid, name: String) -> Result<UserCategory> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let id = Uuid::new_v4();
        let created_at = chrono::Utc::now();

        let res = sqlx::query(
            "INSERT INTO user_categories (id, user_id, name, created_at)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(id)
        .bind(user_id)
        .bind(&name)
        .bind(created_at)
        .execute(&mut *tx)
        .await;

        if let Err(e) = res {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    let _ = tx.rollback().await;
                    return Err(anyhow::anyhow!("Category name already exists"));
                }
            }
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!(e));
        }

        tx.commit().await?;
        Ok(UserCategory {
            id,
            user_id,
            name,
            created_at,
        })
    }

    async fn delete_user_category(&self, category_id: Uuid, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        // Fetch the category name so we can clear any overrides that reference it.
        let name: Option<String> = sqlx::query_scalar(
            "SELECT name FROM user_categories WHERE id = $1 AND user_id = $2",
        )
        .bind(category_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM user_categories WHERE id = $1 AND user_id = $2")
            .bind(category_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        // Remove transaction overrides that used this category name so those
        // transactions revert to their provider category.
        if let Some(cat_name) = name {
            sqlx::query(
                "DELETE FROM transaction_category_overrides WHERE user_id = $1 AND category_name = $2",
            )
            .bind(user_id)
            .bind(cat_name)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn set_transaction_category_override(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
        category_name: String,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "INSERT INTO transaction_category_overrides (transaction_id, user_id, category_name, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (transaction_id, user_id) DO UPDATE SET category_name = EXCLUDED.category_name",
        )
        .bind(transaction_id)
        .bind(user_id)
        .bind(&category_name)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn remove_transaction_category_override(
        &self,
        transaction_id: Uuid,
        user_id: Uuid,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "DELETE FROM transaction_category_overrides WHERE transaction_id = $1 AND user_id = $2",
        )
        .bind(transaction_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn get_category_rules(&self, user_id: Uuid) -> Result<Vec<CategoryRule>> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let rules = sqlx::query_as::<_, CategoryRule>(
            "SELECT id, user_id, pattern, category_name, created_at, updated_at
             FROM category_rules
             WHERE user_id = $1
             ORDER BY created_at ASC",
        )
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;
        tracing::info!(user_id = %user_id, rule_count = rules.len(), "get_category_rules returned");
        Ok(rules)
    }

    async fn create_category_rule(
        &self,
        user_id: Uuid,
        pattern: String,
        category_name: String,
    ) -> Result<CategoryRule> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let id = Uuid::new_v4();
        let now = chrono::Utc::now();

        let res = sqlx::query(
            "INSERT INTO category_rules (id, user_id, pattern, category_name, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $5)",
        )
        .bind(id)
        .bind(user_id)
        .bind(&pattern)
        .bind(&category_name)
        .bind(now)
        .execute(&mut *tx)
        .await;

        if let Err(e) = res {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    let _ = tx.rollback().await;
                    return Err(anyhow::anyhow!("Rule pattern already exists"));
                }
            }
            let _ = tx.rollback().await;
            return Err(anyhow::anyhow!(e));
        }

        tx.commit().await?;
        Ok(CategoryRule {
            id,
            user_id,
            pattern,
            category_name,
            created_at: now,
            updated_at: now,
        })
    }

    async fn update_category_rule(
        &self,
        rule_id: Uuid,
        user_id: Uuid,
        pattern: Option<String>,
        category_name: Option<String>,
    ) -> Result<CategoryRule> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        let now = chrono::Utc::now();

        sqlx::query(
            "UPDATE category_rules
             SET pattern = COALESCE($1, pattern),
                 category_name = COALESCE($2, category_name),
                 updated_at = $3
             WHERE id = $4 AND user_id = $5",
        )
        .bind(pattern)
        .bind(category_name)
        .bind(now)
        .bind(rule_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        let updated = sqlx::query_as::<_, CategoryRule>(
            "SELECT id, user_id, pattern, category_name, created_at, updated_at
             FROM category_rules
             WHERE id = $1 AND user_id = $2",
        )
        .bind(rule_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| anyhow::anyhow!("Rule not found"))?;

        tx.commit().await?;
        Ok(updated)
    }

    async fn delete_category_rule(&self, rule_id: Uuid, user_id: Uuid) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
            .bind(user_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM category_rules WHERE id = $1 AND user_id = $2")
            .bind(rule_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }
}
