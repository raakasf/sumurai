import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives';
import { getTagThemeForCategory } from '../../../utils/categories';
import type { DateRangeKey } from '../../../utils/dateRanges';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
  dateRange?: DateRangeKey;
  onSelectDateRange?: (range: DateRangeKey) => void;
  showSearch?: boolean;
  showCategories?: boolean;
  showDateRange?: boolean;
}

const dateRangeOptions: Array<{ key: DateRangeKey; label: string }> = [
  { key: 'current-month', label: 'Current Month' },
  { key: 'past-2-months', label: '2 Months' },
  { key: 'past-3-months', label: '3 Months' },
  { key: 'past-6-months', label: '6 Months' },
  { key: 'past-year', label: '1 Year' },
  { key: 'all-time', label: '5 Years' },
];

export const TransactionsFilters: React.FC<Props> = ({
  search,
  onSearch,
  categories,
  selectedCategory,
  onSelectCategory,
  dateRange = 'all-time',
  onSelectDateRange,
  showSearch = true,
  showCategories = true,
  showDateRange = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    setShowLeftFade(el.scrollLeft > 0);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  return (
    <>
      {showDateRange && (
        <div
          className={cn(
            'flex',
            'max-w-full',
            'gap-2',
            'overflow-x-auto',
            'rounded-2xl',
            'border',
            'border-slate-200/70',
            'bg-white/80',
            'px-3',
            'py-2',
            'shadow-xl',
            'backdrop-blur-md',
            'ring-1',
            'ring-slate-200/60',
            'dark:border-slate-700/70',
            'dark:bg-slate-800/80',
            'dark:ring-slate-700/60'
          )}
          aria-label="Filter transactions by date range"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dateRangeOptions.map((option) => (
            <button
              type="button"
              key={option.key}
              onClick={() => onSelectDateRange?.(option.key)}
              className={cn(
                'whitespace-nowrap',
                'rounded-lg',
                'px-3',
                'py-1.5',
                'text-sm',
                'font-medium',
                'transition-all',
                'duration-200',
                dateRange === option.key
                  ? 'bg-primary-100 text-slate-900 shadow dark:bg-slate-600 dark:text-slate-100'
                  : 'text-slate-700 hover:-translate-y-[1px] hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-slate-100'
              )}
              aria-pressed={dateRange === option.key}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {showSearch && (
        <div className={cn('relative', 'w-full', 'sm:w-52')}>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search transactions..."
            className={cn(
              'w-full',
              'rounded-full',
              'border',
              'border-black/10',
              'bg-white',
              'px-3.5',
              'py-1.5',
              'text-xs',
              'font-medium',
              'text-slate-900',
              'shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)]',
              'transition-all',
              'duration-200',
              'placeholder:text-slate-400',
              'focus:outline-none',
              'focus:ring-2',
              'focus:ring-sky-400',
              'focus:ring-offset-2',
              'focus:ring-offset-white',
              'dark:border-white/12',
              'dark:bg-[#111a2f]',
              'dark:text-white',
              'dark:placeholder:text-slate-500',
              'dark:focus:ring-sky-400/80',
              'dark:focus:ring-offset-[#0f172a]'
            )}
          />
        </div>
      )}
      {showCategories && (
        <div className={cn('flex', 'w-full', 'items-center', 'gap-3')}>
          <span
            className={cn(
              'flex-shrink-0',
              'text-[0.65rem]',
              'font-semibold',
              'uppercase',
              'tracking-[0.24em]',
              'text-slate-500',
              'transition-colors',
              'duration-500',
              'dark:text-slate-400'
            )}
          >
            Filter
          </span>
          <div className={cn('relative', 'min-w-0', 'flex-1')}>
            <div
              ref={scrollContainerRef}
              onScroll={checkScroll}
              className={cn(
                'scrollbar-hide',
                'flex',
                'items-center',
                'gap-2',
                'overflow-x-auto',
                'pb-1',
                'pl-1',
                'pt-1'
              )}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((name) => {
                const isSelected = selectedCategory === name;
                const theme = getTagThemeForCategory(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onSelectCategory(isSelected ? null : name)}
                    className={`inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 transition-all duration-150 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10 ${theme.tag} ${
                      isSelected
                        ? `ring-2 ${theme.ring}`
                        : 'hover:-translate-y-[2px] hover:shadow-lg'
                    }`}
                    aria-pressed={isSelected}
                    title={isSelected ? `Remove filter: ${name}` : `Filter by ${name}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)] ${theme.dot}`}
                      aria-hidden="true"
                    />
                    {name}
                  </button>
                );
              })}
            </div>
            {showLeftFade && (
              <div
                className={cn(
                  'pointer-events-none',
                  'absolute',
                  'bottom-0',
                  'left-0',
                  'top-0',
                  'w-8',
                  'bg-gradient-to-r',
                  'from-white',
                  'to-transparent',
                  'transition-opacity',
                  'duration-200',
                  'dark:from-[#0f172a]'
                )}
              />
            )}
            {showRightFade && (
              <div
                className={cn(
                  'pointer-events-none',
                  'absolute',
                  'bottom-0',
                  'right-0',
                  'top-0',
                  'w-8',
                  'bg-gradient-to-l',
                  'from-white',
                  'to-transparent',
                  'transition-opacity',
                  'duration-200',
                  'dark:from-[#0f172a]'
                )}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TransactionsFilters;
