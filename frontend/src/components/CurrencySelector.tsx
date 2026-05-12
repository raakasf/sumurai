import { ChevronDown, RefreshCw } from 'lucide-react';
import { useRef } from 'react';
import { type DisplayCurrency, SUPPORTED_DISPLAY_CURRENCIES } from '@/context/CurrencyContext';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/ui/primitives';

interface CurrencySelectorProps {
  scrolled: boolean;
}

const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  INR: '₹',
};

export function CurrencySelector({ scrolled }: CurrencySelectorProps) {
  const { currency, loading, error, rate, rateDate, setCurrency, refreshRate } = useCurrency();
  const selectRef = useRef<HTMLSelectElement>(null);

  const openCurrencyOptions = () => {
    const select = selectRef.current;
    if (!select) return;

    select.focus();
    if ('showPicker' in select) {
      select.showPicker();
    }
  };

  const title =
    currency === 'USD'
      ? 'Display currency: USD'
      : `1 USD = ${rate.toFixed(currency === 'JPY' ? 2 : 4)} ${currency}${
          rateDate ? ` as of ${rateDate}` : ''
        }`;

  return (
    <div
      className={cn(
        'relative',
        'inline-flex',
        'items-center',
        'gap-1.5',
        'rounded-xl',
        'border',
        'border-slate-200',
        'bg-slate-100/80',
        'pr-7',
        'text-slate-700',
        'backdrop-blur-sm',
        'transition-all',
        'duration-200',
        'hover:bg-slate-200',
        'focus-within:ring-2',
        'focus-within:ring-sky-400/80',
        'dark:border-slate-600',
        'dark:bg-slate-700/80',
        'dark:text-slate-100',
        'dark:hover:bg-slate-600',
        scrolled ? 'py-1 pl-1.5 text-xs' : 'py-1.5 pl-1.5 text-sm'
      )}
      title={title}
    >
      <span
        className={cn(
          'pointer-events-none',
          'inline-flex',
          'min-w-6',
          'items-center',
          'justify-center',
          'rounded-lg',
          'bg-sky-500',
          'px-1.5',
          'text-[0.68rem]',
          'font-black',
          'leading-5',
          'text-white',
          'shadow-[0_8px_20px_-12px_rgba(14,165,233,0.9)]',
          error && 'bg-amber-500',
          'dark:bg-sky-400',
          'dark:text-slate-950',
          error && 'dark:bg-amber-300'
        )}
        aria-hidden="true"
      >
        {CURRENCY_SYMBOLS[currency]}
      </span>
      <select
        ref={selectRef}
        value={currency}
        onChange={(event) => setCurrency(event.target.value as DisplayCurrency)}
        aria-label="Display currency"
        className={cn(
          'appearance-none',
          'rounded-lg',
          'border-0',
          'bg-transparent',
          'p-0',
          'font-semibold',
          'text-inherit',
          'focus:outline-none',
          scrolled ? 'text-xs' : 'text-sm'
        )}
      >
        {SUPPORTED_DISPLAY_CURRENCIES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={openCurrencyOptions}
        className={cn(
          'absolute',
          'right-0.5',
          'inline-flex',
          'h-7',
          'w-7',
          'items-center',
          'justify-center',
          'rounded-lg',
          'text-slate-500',
          'transition-colors',
          'hover:bg-slate-200',
          'hover:text-slate-900',
          'focus:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-sky-400/80',
          'dark:text-slate-300',
          'dark:hover:bg-slate-600',
          'dark:hover:text-white'
        )}
        aria-label="Open currency options"
        title="Open currency options"
      >
        <ChevronDown
        className={cn(
          'h-4',
          'w-4'
        )}
      />
      </button>
      {loading && (
        <RefreshCw
          aria-label="Refreshing currency rate"
          className={cn(
            'absolute',
            '-right-6',
            'h-3.5',
            'w-3.5',
            'animate-spin',
            'text-slate-500',
            'dark:text-slate-300'
          )}
        />
      )}
      {error && (
        <button
          type="button"
          onClick={() => void refreshRate()}
          className={cn(
            'absolute',
            '-right-7',
            'rounded-md',
            'px-1',
            'text-xs',
            'font-bold',
            'text-amber-600',
            'hover:bg-amber-100',
            'dark:text-amber-300',
            'dark:hover:bg-amber-900/30'
          )}
          aria-label="Retry currency rate refresh"
          title={error}
        >
          !
        </button>
      )}
    </div>
  );
}
