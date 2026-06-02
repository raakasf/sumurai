import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives';
import { getTagThemeForCategory } from '../../../utils/categories';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
  showSearch?: boolean;
  showCategories?: boolean;
}

export const TransactionsFilters: React.FC<Props> = ({
  search,
  onSearch,
  categories,
  selectedCategory,
  onSelectCategory,
  showSearch = true,
  showCategories = true,
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

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;

      event.preventDefault();
      el.scrollLeft += delta;
      checkScroll();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [checkScroll]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(checkScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [categories, checkScroll]);

  return (
    <>
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
                'overscroll-contain',
                'pb-1',
                'pl-1',
                'pt-1'
              )}
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                overscrollBehavior: 'contain',
              }}
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
