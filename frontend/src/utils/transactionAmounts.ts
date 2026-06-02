import type { Transaction } from '../types/api';
import { isSpendingExcludedCategory } from './categories';

export const getNumericAmount = (transaction: Transaction): number => {
  const amount = Number(transaction.amount);
  return Number.isFinite(amount) ? amount : 0;
};

export const getDisplayAmount = (transaction: Transaction): number => {
  const accountType = transaction.account_type?.toLowerCase() ?? '';
  const isCreditAccount = accountType === 'credit' || accountType === 'credit card';
  const amount = getNumericAmount(transaction);
  return isCreditAccount ? amount : -amount;
};

const SPENDING_EXCLUDED_MERCHANT_PREFIXES = ['md dir ach contrib'];

export const isSpendingTransaction = (transaction: Transaction): boolean => {
  const displayAmount = getDisplayAmount(transaction);
  if (displayAmount >= 0) return false;
  if (isSpendingExcludedCategory(transaction.category?.primary)) return false;

  const merchant = (transaction.merchant || transaction.name || '').trim().toLowerCase();
  return !SPENDING_EXCLUDED_MERCHANT_PREFIXES.some((prefix) => merchant.startsWith(prefix));
};
