use crate::models::budget::Budget;
use crate::services::repository_service::DatabaseRepository;
use rust_decimal::Decimal;
use uuid::Uuid;

pub struct BudgetService;

impl BudgetService {
    pub fn new() -> Self {
        Self
    }

    pub async fn create_budget_for_user<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        user_id: Uuid,
        category: String,
        amount: Decimal,
    ) -> Result<Budget, String> {
        self.create_budget_with_options_for_user(repository, user_id, category, amount, None, None, None).await
    }

    pub async fn create_budget_with_options_for_user<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        user_id: Uuid,
        category: String,
        amount: Decimal,
        frequency: Option<String>,
        rollover: Option<bool>,
        rollover_start_month: Option<String>,
    ) -> Result<Budget, String> {
        if amount <= Decimal::ZERO {
            return Err("Budget amount must be greater than zero".to_string());
        }
        // Prevent duplicate categories for the same user
        let existing = repository
            .get_budgets_for_user(user_id)
            .await
            .map_err(|e| e.to_string())?;
        if existing
            .iter()
            .any(|b| b.category.eq_ignore_ascii_case(&category))
        {
            return Err("Category already exists".to_string());
        }

        let budget = Budget::new_with_options(user_id, category, amount, frequency, rollover, rollover_start_month);
        repository
            .create_budget_for_user(budget)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn update_budget_for_user<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        budget_id: Uuid,
        user_id: Uuid,
        amount: Decimal,
    ) -> Result<Budget, String> {
        self.update_budget_with_options_for_user(repository, budget_id, user_id, Some(amount), None, None, None).await
    }

    pub async fn update_budget_with_options_for_user<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        budget_id: Uuid,
        user_id: Uuid,
        amount: Option<Decimal>,
        frequency: Option<String>,
        rollover: Option<bool>,
        rollover_start_month: Option<String>,
    ) -> Result<Budget, String> {
        if let Some(amt) = amount {
            if amt <= Decimal::ZERO {
                return Err("Budget amount must be greater than zero".to_string());
            }
        }

        repository
            .update_budget_for_user(budget_id, user_id, amount, frequency, rollover, rollover_start_month)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn delete_budget_for_user<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        budget_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), String> {
        repository
            .delete_budget_for_user(budget_id, user_id)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_budgets_for_user<R: DatabaseRepository + ?Sized>(
        &self,
        repository: &R,
        user_id: Uuid,
    ) -> Result<Vec<Budget>, String> {
        repository
            .get_budgets_for_user(user_id)
            .await
            .map_err(|e| e.to_string())
    }
}
