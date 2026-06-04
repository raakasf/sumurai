//! Aggregated analytics queries for dashboards.

use crate::models::analytics::{
    BalanceCategory, CashFlowPoint, CategorySpending, DailySpending, MonthlyCashFlowAggregate,
    MonthlySpending, TopMerchant,
};
use crate::models::transaction::Transaction;
use crate::services::repository_service::{
    DatabaseRepository, EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES,
};
use anyhow::Result;
use chrono::Datelike;
use rust_decimal::Decimal;
use uuid::Uuid;

pub struct AnalyticsService;

fn truncate_to_latest_months<T>(result: &mut Vec<T>, months: u32) {
    let keep = months as usize;
    if result.len() > keep {
        let drop_count = result.len() - keep;
        result.drain(0..drop_count);
    }
}

#[allow(dead_code)]
impl AnalyticsService {
    pub fn map_account_to_balance_category(
        account_type: &str,
        account_subtype: Option<&str>,
    ) -> BalanceCategory {
        let t = account_type.to_lowercase();
        match t.as_str() {
            "depository" => BalanceCategory::Cash,
            "credit" => BalanceCategory::Credit,
            "loan" => BalanceCategory::Loan,
            "investment" => BalanceCategory::Investments,
            "property" | "real_estate" | "real-estate" | "home" => BalanceCategory::Property,
            _ => {
                // Fallback: try to infer based on subtype keywords, else Investments
                if let Some(st) = account_subtype {
                    let st = st.to_lowercase();
                    if st.contains("credit") {
                        return BalanceCategory::Credit;
                    }
                    if st.contains("loan") {
                        return BalanceCategory::Loan;
                    }
                    if st.contains("checking") || st.contains("savings") {
                        return BalanceCategory::Cash;
                    }
                    if st.contains("credit") {
                        return BalanceCategory::Credit;
                    }
                    if st.contains("loan") {
                        return BalanceCategory::Loan;
                    }
                    if st.contains("checking") || st.contains("savings") {
                        return BalanceCategory::Cash;
                    }
                    if st.contains("property") || st.contains("real estate") || st.contains("home") {
                        return BalanceCategory::Property;
                    }
                }
                BalanceCategory::Investments
            }
        }
    }

    pub fn compute_positive_negative_ratio(
        positives_total: Decimal,
        negatives_total: Decimal,
    ) -> Option<Decimal> {
        if negatives_total == Decimal::ZERO {
            return None;
        }
        let denom = (-negatives_total).max(Decimal::ONE);
        let ratio = positives_total / denom;
        Some(Self::round_amount(ratio))
    }

    pub fn new() -> Self {
        Self
    }

    pub async fn load_spending_transactions(
        &self,
        repository: &dyn DatabaseRepository,
        user_id: &Uuid,
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
    ) -> Result<Vec<Transaction>> {
        match (start_date, end_date) {
            (Some(start_date), Some(end_date)) => {
                repository
                    .get_spending_transactions_by_date_range_for_user(user_id, start_date, end_date)
                    .await
            }
            _ => repository.get_spending_transactions_for_user(user_id).await,
        }
    }

    pub fn current_month_date_range(&self) -> (chrono::NaiveDate, chrono::NaiveDate) {
        let now = chrono::Utc::now().naive_utc().date();
        Self::get_month_range_static(now.year(), now.month())
    }

    pub fn month_date_range(
        &self,
        year: i32,
        month: u32,
    ) -> Option<(chrono::NaiveDate, chrono::NaiveDate)> {
        chrono::NaiveDate::from_ymd_opt(year, month, 1)
            .map(|_| Self::get_month_range_static(year, month))
    }

    fn get_previous_month_info(year: i32, month: u32) -> (i32, u32) {
        if month == 1 {
            (year - 1, 12)
        } else {
            (year, month - 1)
        }
    }

    fn months_back(year: i32, month: u32, back: u32) -> (i32, u32) {
        let total_months = year * 12 + (month as i32) - 1 - (back as i32);
        let new_year = total_months.div_euclid(12);
        let new_month0 = total_months.rem_euclid(12); // 0..11
        (new_year, (new_month0 + 1) as u32)
    }

    pub fn get_period_date_range(period: &str) -> Option<(chrono::NaiveDate, chrono::NaiveDate)> {
        use chrono::Datelike;
        let now = chrono::Utc::now().naive_utc().date();
        let year = now.year();
        let month = now.month();

        match period {
            "current-month" => Some(Self::get_month_range_static(year, month)),
            "past-2-months" => {
                let (sy, sm) = Self::months_back(year, month, 1);
                Some((
                    chrono::NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                    // end of current month
                    if month == 12 {
                        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    } else {
                        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    },
                ))
            }
            "past-6-months" => {
                let (sy, sm) = Self::months_back(year, month, 5);
                Some((
                    chrono::NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                    if month == 12 {
                        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    } else {
                        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    },
                ))
            }
            "past-year" => {
                let (sy, sm) = Self::months_back(year, month, 11);
                Some((
                    chrono::NaiveDate::from_ymd_opt(sy, sm, 1).unwrap(),
                    if month == 12 {
                        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    } else {
                        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
                            .unwrap()
                            .pred_opt()
                            .unwrap()
                    },
                ))
            }
            _ => None,
        }
    }

    pub fn filter_by_date_range<'a>(
        &self,
        transactions: &'a [Transaction],
        start: Option<chrono::NaiveDate>,
        end: Option<chrono::NaiveDate>,
    ) -> Vec<&'a Transaction> {
        match (start, end) {
            (Some(s), Some(e)) => transactions
                .iter()
                .filter(|t| t.date >= s && t.date <= e)
                .collect(),
            _ => transactions.iter().collect(),
        }
    }

    fn round_amount(amount: Decimal) -> Decimal {
        amount.round_dp(2)
    }

    fn round_percentage(percentage: Decimal) -> Decimal {
        percentage.round_dp(1)
    }

    fn get_category_name(transaction: &Transaction) -> String {
        if transaction.category_primary.is_empty() {
            "Uncategorized".to_string()
        } else {
            transaction.category_primary.clone()
        }
    }

    fn normalize_category_key(category: &str) -> String {
        category
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .flat_map(char::to_lowercase)
            .collect()
    }

    pub fn is_spending_excluded_category(category: &str) -> bool {
        matches!(
            Self::normalize_category_key(category).as_str(),
            "creditcardbill"
                | "creditcardbills"
                | "creditcardpayment"
                | "creditcardpayments"
                | "transferin"
                | "transferout"
        )
    }

    fn is_spending_transaction(transaction: &Transaction) -> bool {
        transaction.amount > Decimal::ZERO
            && !Self::is_spending_excluded_category(&Self::get_category_name(transaction))
    }

    fn get_effective_category_name(transaction: &TransactionWithAccount) -> String {
        transaction
            .custom_category
            .as_ref()
            .or(transaction.rule_category.as_ref())
            .filter(|category| !category.is_empty())
            .cloned()
            .unwrap_or_else(|| {
                if transaction.category_primary.is_empty() {
                    "Uncategorized".to_string()
                } else {
                    transaction.category_primary.clone()
                }
            })
    }

    fn is_spending_transaction_with_account(transaction: &TransactionWithAccount) -> bool {
        transaction.amount != Decimal::ZERO
            && !Self::is_spending_excluded_category(&Self::get_effective_category_name(transaction))
    }

    fn get_spending_amount_with_account(transaction: &TransactionWithAccount) -> Decimal {
        if transaction.amount < Decimal::ZERO {
            -transaction.amount
        } else {
            transaction.amount
        }
    }

    pub fn sum_spending_transactions_with_account(
        transactions: &[TransactionWithAccount],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
    ) -> Decimal {
        transactions
            .iter()
            .filter(|transaction| {
                if let (Some(start), Some(end)) = (start_date, end_date) {
                    if transaction.date < start || transaction.date > end {
                        return false;
                    }
                }
                Self::is_spending_transaction_with_account(transaction)
            })
            .map(Self::get_spending_amount_with_account)
            .sum()
    }

    pub fn group_transactions_by_category(
        transactions: Vec<&Transaction>,
    ) -> Vec<CategorySpending> {
        let mut category_map = std::collections::HashMap::new();

        for transaction in transactions {
            if transaction.amount >= Decimal::ZERO {
                continue;
            }
            let category_name = Self::get_category_name(transaction);
            *category_map.entry(category_name).or_insert(Decimal::ZERO) += -transaction.amount;
        }

        category_map
            .into_iter()
            .map(|(name, value)| CategorySpending { name, value })
            .collect()
    }

    pub fn group_by_category_with_date_range(
        &self,
        transactions: &[Transaction],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
    ) -> Vec<CategorySpending> {
        let filtered_transactions = self.filter_by_date_range(transactions, start_date, end_date);
        Self::group_transactions_by_category(filtered_transactions)
    }

    pub fn group_transactions_with_account_by_effective_category(
        transactions: &[TransactionWithAccount],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
    ) -> Vec<CategorySpending> {
        let mut category_map = std::collections::HashMap::new();

        for transaction in transactions {
            if !Self::is_spending_transaction_with_account(transaction) {
                continue;
            }

            if let (Some(start), Some(end)) = (start_date, end_date) {
                if transaction.date < start || transaction.date > end {
                    continue;
                }
            }

            let category_name = Self::get_effective_category_name(transaction);

            *category_map.entry(category_name).or_insert(Decimal::ZERO) +=
                Self::get_spending_amount_with_account(transaction);
        }

        category_map
            .into_iter()
            .map(|(name, value)| CategorySpending { name, value })
            .collect()
    }

    pub fn calculate_monthly_totals(
        &self,
        transactions: &[Transaction],
        months: u32,
    ) -> Vec<MonthlySpending> {
        use chrono::Datelike;

        let mut monthly_totals = std::collections::HashMap::new();

        for transaction in transactions {
            if transaction.amount >= Decimal::ZERO {
                continue;
            }
            let month_key = format!(
                "{}-{:02}",
                transaction.date.year(),
                transaction.date.month()
            );
            *monthly_totals.entry(month_key).or_insert(Decimal::ZERO) += -transaction.amount;
        }

        let mut result: Vec<MonthlySpending> = monthly_totals
            .into_iter()
            .map(|(month, total)| MonthlySpending { month, total })
            .collect();

        result.sort_by(|a, b| a.month.cmp(&b.month));
        truncate_to_latest_months(&mut result, months);

        result
    }

    pub fn calculate_cash_flow(
        &self,
        transactions: &[Transaction],
        months: u32,
    ) -> Vec<CashFlowPoint> {
        use chrono::Datelike;

        #[derive(Default)]
        struct MonthlyCashFlow {
            income: Decimal,
            expenses: Decimal,
        }

        let mut monthly_flows = std::collections::HashMap::new();

        for transaction in transactions {
            let month_key = format!(
                "{}-{:02}",
                transaction.date.year(),
                transaction.date.month()
            );
            let flow = monthly_flows
                .entry(month_key)
                .or_insert(MonthlyCashFlow::default());

            if transaction.amount > Decimal::ZERO && transaction.category_primary != "TRANSFER_IN" {
                flow.income += transaction.amount;
            } else if transaction.amount < Decimal::ZERO
                && !EXCLUDED_ANALYTICS_CATEGORY_PRIMARIES
                    .contains(&transaction.category_primary.as_str())
            {
                flow.expenses += -transaction.amount;
            }
        }

        let aggregates = monthly_flows
            .into_iter()
            .map(|(month, flow)| MonthlyCashFlowAggregate {
                month,
                income: flow.income,
                expenses: flow.expenses,
            })
            .collect::<Vec<_>>();

        self.cash_flow_from_monthly_aggregates(&aggregates, months)
    }

    pub fn cash_flow_from_monthly_aggregates(
        &self,
        aggregates: &[MonthlyCashFlowAggregate],
        months: u32,
    ) -> Vec<CashFlowPoint> {
        let mut result: Vec<CashFlowPoint> = aggregates
            .iter()
            .map(|aggregate| {
                let income = Self::round_amount(aggregate.income);
                let expenses = Self::round_amount(aggregate.expenses);
                CashFlowPoint {
                    month: aggregate.month.clone(),
                    income,
                    expenses,
                    net: Self::round_amount(income - expenses),
                }
            })
            .collect();

        result.sort_by(|a, b| a.month.cmp(&b.month));
        truncate_to_latest_months(&mut result, months);

        result
    }

    pub fn calculate_monthly_totals_with_account(
        &self,
        transactions: &[TransactionWithAccount],
        months: u32,
    ) -> Vec<MonthlySpending> {
        use chrono::Datelike;

        let mut monthly_totals = std::collections::HashMap::new();

        for transaction in transactions {
            if !Self::is_spending_transaction_with_account(transaction) {
                continue;
            }
            let month_key = format!(
                "{}-{:02}",
                transaction.date.year(),
                transaction.date.month()
            );
            *monthly_totals.entry(month_key).or_insert(Decimal::ZERO) +=
                Self::get_spending_amount_with_account(transaction);
        }

        let mut result: Vec<MonthlySpending> = monthly_totals
            .into_iter()
            .map(|(month, total)| MonthlySpending { month, total })
            .collect();

        result.sort_by(|a, b| a.month.cmp(&b.month));

        if result.len() > months as usize {
            result.truncate(months as usize);
        }

        result
    }

    pub fn calculate_monthly_category_totals_with_account(
        &self,
        transactions: &[TransactionWithAccount],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
    ) -> Vec<CategoryMonthlySpending> {
        let mut totals = std::collections::HashMap::new();

        for transaction in transactions {
            if !Self::is_spending_transaction_with_account(transaction) {
                continue;
            }
            if start_date.is_some_and(|start| transaction.date < start)
                || end_date.is_some_and(|end| transaction.date > end)
            {
                continue;
            }

            let month = format!(
                "{}-{:02}",
                transaction.date.year(),
                transaction.date.month()
            );
            let category = Self::get_effective_category_name(transaction);
            *totals.entry((month, category)).or_insert(Decimal::ZERO) +=
                Self::get_spending_amount_with_account(transaction);
        }

        let mut result: Vec<CategoryMonthlySpending> = totals
            .into_iter()
            .map(|((month, category), amount)| CategoryMonthlySpending {
                month,
                category,
                amount: Self::round_amount(amount),
            })
            .collect();
        result.sort_by(|a, b| {
            a.month
                .cmp(&b.month)
                .then_with(|| a.category.cmp(&b.category))
        });
        result
    }

    pub fn get_top_merchants(
        &self,
        transactions: &[Transaction],
        limit: usize,
    ) -> Vec<TopMerchant> {
        use std::collections::HashMap;

        let mut merchant_map: HashMap<String, (Decimal, u32)> = HashMap::new();

        for transaction in transactions {
            if transaction.amount >= Decimal::ZERO {
                continue;
            }
            let merchant_name = transaction
                .merchant_name
                .clone()
                .unwrap_or_else(|| "Unknown Merchant".to_string());

            let entry = merchant_map
                .entry(merchant_name)
                .or_insert((Decimal::ZERO, 0));
            entry.0 += -transaction.amount;
            entry.1 += 1;
        }

        let total_spend: Decimal = transactions
            .iter()
            .filter(|t| t.amount < Decimal::ZERO)
            .map(|t| -t.amount)
            .sum();

        let mut merchants: Vec<TopMerchant> = merchant_map
            .into_iter()
            .map(|(name, (amount, count))| {
                let percentage = if total_spend > Decimal::ZERO {
                    Self::round_percentage((amount / total_spend) * Decimal::from(100))
                } else {
                    Decimal::ZERO
                };

                TopMerchant {
                    name,
                    amount: Self::round_amount(amount),
                    count,
                    percentage,
                }
            })
            .collect();

        merchants.sort_by_key(|merchant| std::cmp::Reverse(merchant.amount));

        merchants.truncate(limit);

        merchants
    }

    pub fn get_top_merchants_with_date_range(
        &self,
        transactions: &[Transaction],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
        limit: usize,
    ) -> Vec<TopMerchant> {
        let filtered_transactions = self.filter_by_date_range(transactions, start_date, end_date);
        let transactions_slice: Vec<Transaction> =
            filtered_transactions.into_iter().cloned().collect();
        self.get_top_merchants(&transactions_slice, limit)
    }

    pub fn get_top_merchants_with_account_date_range(
        &self,
        transactions: &[TransactionWithAccount],
        start_date: Option<chrono::NaiveDate>,
        end_date: Option<chrono::NaiveDate>,
        limit: usize,
    ) -> Vec<TopMerchant> {
        use std::collections::HashMap;

        let mut merchant_map: HashMap<String, (Decimal, u32)> = HashMap::new();

        for transaction in transactions {
            if let (Some(start), Some(end)) = (start_date, end_date) {
                if transaction.date < start || transaction.date > end {
                    continue;
                }
            }

            if !Self::is_spending_transaction_with_account(transaction) {
                continue;
            }

            let merchant_name = transaction
                .merchant_name
                .clone()
                .unwrap_or_else(|| "Unknown Merchant".to_string());

            let entry = merchant_map
                .entry(merchant_name)
                .or_insert((Decimal::ZERO, 0));
            entry.0 += Self::get_spending_amount_with_account(transaction);
            entry.1 += 1;
        }

        let total_spend: Decimal = merchant_map.values().map(|(amount, _)| *amount).sum();

        let mut merchants: Vec<TopMerchant> = merchant_map
            .into_iter()
            .map(|(name, (amount, count))| {
                let percentage = if total_spend > Decimal::ZERO {
                    Self::round_percentage((amount / total_spend) * Decimal::from(100))
                } else {
                    Decimal::ZERO
                };

                TopMerchant {
                    name,
                    amount: Self::round_amount(amount),
                    count,
                    percentage,
                }
            })
            .collect();

        merchants.sort_by(|a, b| b.amount.cmp(&a.amount));

        merchants.truncate(limit);

        merchants
    }

    pub fn calculate_current_month_spending_with_account(
        &self,
        transactions: &[TransactionWithAccount],
    ) -> Decimal {
        let now = chrono::Utc::now().naive_utc().date();
        let (start, end) = self.get_month_range(now.year(), now.month());
        Self::sum_spending_transactions_with_account(transactions, Some(start), Some(end))
    }

    pub fn calculate_current_month_spending(&self, transactions: &[Transaction]) -> Decimal {
        let now = chrono::Utc::now().naive_utc().date();
        let (start, end) = self.get_month_range(now.year(), now.month());
        transactions
            .iter()
            .filter(|t| t.date >= start && t.date <= end && t.amount < Decimal::ZERO)
            .map(|t| -t.amount)
            .sum()
    }

    pub fn calculate_daily_spending(
        &self,
        transactions: &[Transaction],
        year: i32,
        month: u32,
    ) -> Vec<DailySpending> {
        let days_in_month = chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
            .unwrap_or(chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap())
            .pred_opt()
            .unwrap()
            .day();
        let mut totals = vec![Decimal::ZERO; days_in_month as usize];
        for t in transactions {
            if t.date.year() == year && t.date.month() == month && t.amount < Decimal::ZERO {
                let idx = (t.date.day() - 1) as usize;
                totals[idx] += -t.amount;
            }
        }
        let mut cumulative = Decimal::ZERO;
        totals
            .into_iter()
            .enumerate()
            .map(|(i, spend)| {
                cumulative += spend;
                DailySpending {
                    day: (i + 1) as u32,
                    spend,
                    cumulative,
                }
            })
            .collect()
    }

    pub fn calculate_daily_spending_with_account(
        &self,
        transactions: &[TransactionWithAccount],
        year: i32,
        month: u32,
    ) -> Vec<DailySpending> {
        let days_in_month = chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
            .unwrap_or(chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap())
            .pred_opt()
            .unwrap()
            .day();
        let mut totals = vec![Decimal::ZERO; days_in_month as usize];
        for t in transactions {
            if t.date.year() == year
                && t.date.month() == month
                && Self::is_spending_transaction_with_account(t)
            {
                let idx = (t.date.day() - 1) as usize;
                totals[idx] += Self::get_spending_amount_with_account(t);
            }
        }
        let mut cumulative = Decimal::ZERO;
        totals
            .into_iter()
            .enumerate()
            .map(|(i, spend)| {
                cumulative += spend;
                DailySpending {
                    day: (i + 1) as u32,
                    spend,
                    cumulative,
                }
            })
            .collect()
    }

    fn get_month_range_static(year: i32, month: u32) -> (chrono::NaiveDate, chrono::NaiveDate) {
        let start_date = chrono::NaiveDate::from_ymd_opt(year, month, 1).unwrap();
        let end_date = if month == 12 {
            chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1)
                .unwrap()
                .pred_opt()
                .unwrap()
        } else {
            chrono::NaiveDate::from_ymd_opt(year, month + 1, 1)
                .unwrap()
                .pred_opt()
                .unwrap()
        };
        (start_date, end_date)
    }

    fn get_month_range(&self, year: i32, month: u32) -> (chrono::NaiveDate, chrono::NaiveDate) {
        Self::get_month_range_static(year, month)
    }
}
