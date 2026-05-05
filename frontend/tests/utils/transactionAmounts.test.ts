import { getDisplayAmount } from '@/utils/transactionAmounts';
import type { Transaction } from '@/types/api';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'txn-1',
  date: '2026-05-03',
  name: 'Test',
  amount: 0,
  category: { primary: 'OTHER' },
  account_name: 'Account',
  account_type: 'depository',
  ...overrides,
});

describe('transaction amount utilities', () => {
  it('keeps credit card amounts signed as displayed even when backend returns strings', () => {
    expect(getDisplayAmount(transaction({ account_type: 'credit', amount: '-35.00' as unknown as number }))).toBe(-35);
    expect(getDisplayAmount(transaction({ account_type: 'credit', amount: '12.50' as unknown as number }))).toBe(12.5);
  });

  it('flips depository amounts to match the transaction table display', () => {
    expect(getDisplayAmount(transaction({ account_type: 'depository', amount: '42.25' as unknown as number }))).toBe(-42.25);
    expect(getDisplayAmount(transaction({ account_type: 'depository', amount: '-1500.00' as unknown as number }))).toBe(1500);
  });
});
