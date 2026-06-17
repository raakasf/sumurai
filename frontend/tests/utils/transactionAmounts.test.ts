import { describe, expect, it } from '@jest/globals';
import type { Transaction } from '@/types/api';
import {
  getDisplayAmount,
  getNetSpendingAmount,
  isSpendingTransaction,
} from '@/utils/transactionAmounts';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'txn_1',
  account_id: 'acc_1',
  date: '2026-06-03',
  name: 'Best Buy',
  merchant: 'Best Buy',
  amount: 42.99,
  category: { primary: 'GENERAL_MERCHANDISE' },
  account_name: 'Best Buy Credit Card',
  account_type: 'credit',
  provider: 'plaid',
  ...overrides,
});

describe('transactionAmounts', () => {
  it('renders positive Plaid credit-card purchases as spending', () => {
    const purchase = transaction({ amount: 42.99, account_type: 'credit', provider: 'plaid' });

    expect(getDisplayAmount(purchase)).toBe(-42.99);
    expect(isSpendingTransaction(purchase)).toBe(true);
  });

  it('renders negative Teller credit-card purchases as spending', () => {
    const purchase = transaction({
      amount: -25,
      account_name: 'Prime Visa',
      account_type: 'credit',
      provider: 'teller',
    });

    expect(getDisplayAmount(purchase)).toBe(-25);
    expect(isSpendingTransaction(purchase)).toBe(true);
  });

  it('renders negative stored Plaid credits as income', () => {
    const payment = transaction({ amount: -25, account_type: 'credit', provider: 'plaid' });

    expect(getDisplayAmount(payment)).toBe(25);
    expect(isSpendingTransaction(payment)).toBe(false);
  });

  it('subtracts credit-card refunds from net spending', () => {
    const tellerRefund = transaction({ amount: 25, account_type: 'credit', provider: 'teller' });
    const plaidRefund = transaction({ amount: -15, account_type: 'credit', provider: 'plaid' });

    expect(getNetSpendingAmount(tellerRefund)).toBe(-25);
    expect(getNetSpendingAmount(plaidRefund)).toBe(-15);
  });
});
