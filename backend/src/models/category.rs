use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[allow(unused_imports)]
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
#[schema(example = json!({
    "id": "11111111-2222-3333-4444-555555555555",
    "user_id": "99999999-8888-7777-6666-555555555555",
    "name": "Travel",
    "created_at": "2024-01-01T12:00:00Z"
}))]
pub struct UserCategory {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub parent_category: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"name": "AI", "parent_category": "Bills & Utilities"}))]
pub struct CreateCategoryRequest {
    pub name: String,
    pub parent_category: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"deleted": true, "id": "11111111-2222-3333-4444-555555555555"}))]
pub struct DeleteCategoryResponse {
    pub deleted: bool,
    pub id: String,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"category_name": "Food & Dining", "subcategory_name": "Coffee Shops"}))]
pub struct UpdateTransactionCategoryRequest {
    pub category_name: String,
    pub subcategory_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
#[schema(example = json!({
    "id": "22222222-3333-4444-5555-666666666666",
    "user_id": "99999999-8888-7777-6666-555555555555",
    "pattern": "MD DIR ACH CONTRIB*",
    "category_name": "Education",
    "subcategory_name": "Tuition",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
}))]
pub struct CategoryRule {
    pub id: Uuid,
    pub user_id: Uuid,
    pub pattern: String,
    pub category_name: String,
    pub subcategory_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"pattern": "MD DIR ACH CONTRIB*", "category_name": "Education", "subcategory_name": "Tuition"}))]
pub struct CreateCategoryRuleRequest {
    pub pattern: String,
    pub category_name: String,
    pub subcategory_name: Option<String>,
}

#[derive(Deserialize, ToSchema)]
#[schema(example = json!({"pattern": "MD DIR ACH*", "category_name": "Education", "subcategory_name": "Tuition"}))]
pub struct UpdateCategoryRuleRequest {
    pub pattern: Option<String>,
    pub category_name: Option<String>,
    pub subcategory_name: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[schema(example = json!({"deleted": true, "id": "22222222-3333-4444-5555-666666666666"}))]
pub struct DeleteCategoryRuleResponse {
    pub deleted: bool,
    pub id: String,
}
