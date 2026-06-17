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

export const getNetSpendingAmount = (transaction: Transaction): number => {
  if (isSpendingExcludedCategory(transaction.category?.primary)) return 0;

  return -getDisplayAmount(transaction);
};

export const isSpendingTransaction = (transaction: Transaction): boolean => {
  const displayAmount = getDisplayAmount(transaction);
  if (displayAmount >= 0) return false;
  if (isSpendingExcludedCategory(transaction.category?.primary)) return false;

  return true;
};
