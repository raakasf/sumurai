import { createContext } from 'react';

export type DisplayCurrency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'INR';

export interface CurrencyContextType {
  currency: DisplayCurrency;
  rate: number;
  rateDate: string | null;
  loading: boolean;
  error: string | null;
  setCurrency: (currency: DisplayCurrency) => void;
  format: (value: number | string) => string;
  formatConverted: (value: number | string) => string;
  convert: (value: number | string) => number;
  refreshRate: () => Promise<void>;
}

export const SUPPORTED_DISPLAY_CURRENCIES: DisplayCurrency[] = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'INR',
];

export const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
