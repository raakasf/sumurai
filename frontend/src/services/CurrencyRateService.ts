import type { DisplayCurrency } from '../context/CurrencyContext';
import { ApiClient } from './ApiClient';

interface CurrencyRateResponse {
  base: 'USD';
  currency: DisplayCurrency;
  rate: number;
  date?: string;
}

export async function getUsdRate(
  currency: DisplayCurrency
): Promise<{ rate: number; date: string | null }> {
  if (currency === 'USD') {
    return { rate: 1, date: new Date().toISOString().slice(0, 10) };
  }

  const data = await ApiClient.get<CurrencyRateResponse>(
    `/currency/rate?currency=${encodeURIComponent(currency)}`
  );
  const rate = data.rate;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Rate unavailable for ${currency}`);
  }

  return { rate, date: data.date ?? null };
}
