import {
  formatCategoryName,
  getTagThemeForCategory,
  isSpendingExcludedCategory,
} from '@/utils/categories';

describe('categories utils', () => {
  it('formats category names from snake_case', () => {
    expect(formatCategoryName('fast_food')).toBe('Fast Food');
    expect(formatCategoryName('TRANSPORT')).toBe('Transport');
    expect(formatCategoryName('Credit Card Bills')).toBe('Credit Card Bills');
    expect(formatCategoryName('Credit card bills')).toBe('Credit Card Bills');
    expect(formatCategoryName(undefined)).toBe('Other');
    expect(formatCategoryName(null as any)).toBe('Other');
  });

  it('maps same name to stable theme', () => {
    const a = getTagThemeForCategory('Groceries');
    const b = getTagThemeForCategory('groceries');
    expect(a.key).toBeDefined();
    expect(a.tag).toBeDefined();
    expect(a.ring).toBeDefined();
    expect(a.ringHex).toBeDefined();
    expect(a.key).toEqual(b.key);
    expect(a.tag).toEqual(b.tag);
    expect(a.ringHex).toEqual(b.ringHex);
  });

  it('identifies transfer-like categories that should not count as spending', () => {
    expect(isSpendingExcludedCategory('Credit Card Bills')).toBe(true);
    expect(isSpendingExcludedCategory('Credit Card Bill')).toBe(true);
    expect(isSpendingExcludedCategory('CREDIT_CARD_PAYMENT')).toBe(true);
    expect(isSpendingExcludedCategory('Credit Card Payments')).toBe(true);
    expect(isSpendingExcludedCategory('TRANSFER_OUT')).toBe(true);
    expect(isSpendingExcludedCategory('Groceries')).toBe(false);
  });
});
