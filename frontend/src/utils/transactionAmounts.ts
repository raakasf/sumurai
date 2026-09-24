import type { Transaction } from '../types/api';
import { isSpendingExcludedCategory } from './categories';

export const getNumericAmount = (transaction: Transaction): number => {
  const amount = Number(transaction.amount);
  return Number.isFinite(amount) ? amount : 0;
};

export const getDisplayAmount = (transaction: Transaction): number => {
  const amount = getNumericAmount(transaction);
  const accountType = transaction.account_type?.toLowerCase() ?? '';
  const isCreditAccount = accountType === 'credit' || accountType === 'credit card';
  if (transaction.provider === 'teller' && isCreditAccount) {
    return amount;
  }
  return -amount;
};

const isTransactionCategoryExcluded = (transaction: Transaction): boolean => {
  if (
    isSpendingExcludedCategory(transaction.category?.primary) ||
    isSpendingExcludedCategory(transaction.category?.detailed) ||
    isSpendingExcludedCategory(transaction.custom_category) ||
    isSpendingExcludedCategory(transaction.rule_category)
  ) {
    return true;
  }

  const accountType = transaction.account_type?.toLowerCase() ?? '';
  const isCreditAccount = accountType === 'credit' || accountType === 'credit card';
  const primaryKey = (transaction.category?.primary || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (isCreditAccount && primaryKey === 'loanpayments') {
    return true;
  }

  return false;
};

export const getNetSpendingAmount = (transaction: Transaction): number => {
  if (isTransactionCategoryExcluded(transaction)) return 0;

  const accountType = transaction.account_type?.toLowerCase() ?? '';
  const isCreditAccount = accountType === 'credit' || accountType === 'credit card';

  // For non-credit accounts (depository, checking, savings),
  // inflows/deposits (displayAmount >= 0) are never negative spending.
  if (!isCreditAccount) {
    const displayAmount = getDisplayAmount(transaction);
    if (displayAmount >= 0) return 0;
    return -displayAmount;
  }

  return -getDisplayAmount(transaction);
};

export const isSpendingTransaction = (transaction: Transaction): boolean => {
  const displayAmount = getDisplayAmount(transaction);
  if (displayAmount >= 0) return false;
  if (isTransactionCategoryExcluded(transaction)) return false;

  return true;
};
