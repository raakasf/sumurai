use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[allow(unused_imports)]
use serde_json::json;

fn default_frequency() -> String {
    "monthly".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::FromRow, ToSchema)]
#[schema(example = json!({
    "id": "11111111-2222-3333-4444-555555555555",
    "user_id": "99999999-8888-7777-6666-555555555555",
    "category": "groceries",
    "amount": "500.00",
    "frequency": "monthly",
    "rollover": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-15T12:00:00Z"
}))]
pub struct Budget {
    pub id: Uuid,
    pub user_id: Uuid,
    pub category: String,
    #[schema(value_type = String)]
    pub amount: Decimal,
    #[serde(default = "default_frequency")]
    pub frequency: String,
    #[serde(default)]
    pub rollover: bool,
    #[serde(default)]
    pub rollover_start_month: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Budget {
    pub fn new(user_id: Uuid, category: String, amount: Decimal) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            user_id,
            category,
            amount,
            frequency: "monthly".to_string(),
            rollover: false,
            rollover_start_month: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn new_with_options(
        user_id: Uuid,
        category: String,
        amount: Decimal,
        frequency: Option<String>,
        rollover: Option<bool>,
        rollover_start_month: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            user_id,
            category,
            amount,
            frequency: frequency.unwrap_or_else(|| "monthly".to_string()),
            rollover: rollover.unwrap_or(false),
            rollover_start_month,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"category": "groceries", "amount": "500.00", "frequency": "monthly", "rollover": false, "rollover_start_month": "2026-09"}))]
pub struct CreateBudgetRequest {
    pub category: String,
    #[schema(value_type = String)]
    pub amount: rust_decimal::Decimal,
    pub frequency: Option<String>,
    pub rollover: Option<bool>,
    pub rollover_start_month: Option<String>,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"amount": "625.00", "frequency": "monthly", "rollover": true, "rollover_start_month": "2026-09"}))]
pub struct UpdateBudgetRequest {
    #[schema(value_type = String)]
    pub amount: Option<rust_decimal::Decimal>,
    pub frequency: Option<String>,
    pub rollover: Option<bool>,
    pub rollover_start_month: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"deleted": true, "budget_id": "11111111-2222-3333-4444-555555555555"}))]
pub struct DeleteBudgetResponse {
    pub deleted: bool,
    pub budget_id: String,
}
