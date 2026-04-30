import type { AnalyticsTopMerchantsResponse } from '../../../types/api';
import { formatCategoryName } from '../../../utils/categories';

export type DonutDatum = { name: string; value: number };

type CategoryDatum = {
  category?: string | null;
  name?: string | null;
  amount?: number | string | null;
  value?: number | string | null;
};

export function categoriesToDonut(categories: CategoryDatum[] = []): DonutDatum[] {
  const categoryTotals = new Map<string, number>();

  for (const c of categories) {
    const rawName: string = (c.category ?? c.name ?? 'Unknown') || 'Unknown';
    const rawAmount: number | string | null | undefined = c.amount ?? c.value ?? 0;
    const value = typeof rawAmount === 'string' ? Number(rawAmount) : Number(rawAmount || 0);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    const name = formatCategoryName(rawName);
    categoryTotals.set(name, (categoryTotals.get(name) || 0) + value);
  }

  const positive = Array.from(categoryTotals, ([name, value]) => ({ name, value }));
  positive.sort((a, b) => b.value - a.value);
  return positive;
}

export type MerchantItem = AnalyticsTopMerchantsResponse;

export function normalizeMerchants(items: AnalyticsTopMerchantsResponse[]): MerchantItem[] {
  return (items || []).slice().sort((a, b) => Number(b.amount) - Number(a.amount));
}
