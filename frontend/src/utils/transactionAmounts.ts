import type { Transaction } from '../types/api';

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
