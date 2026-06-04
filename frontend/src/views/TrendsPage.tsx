import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '../components/ui/Card';
import { useAccountFilter } from '../hooks/useAccountFilter';
import { useCurrency } from '../hooks/useCurrency';
import { PageLayout } from '../layouts/PageLayout';
import { AnalyticsService } from '../services/AnalyticsService';
import type { AnalyticsCategoryTrendResponse } from '../types/api';
import { Button, cn } from '../ui/primitives';
import { formatCategoryName } from '../utils/categories';

type RangeKey = 'ytd' | '6-months' | '12-months' | '24-months' | 'all-time';

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: 'ytd', label: 'Year to date' },
  { key: '6-months', label: 'Last 6 months' },
  { key: '12-months', label: 'Last 12 months' },
  { key: '24-months', label: 'Last 2 years' },
  { key: 'all-time', label: 'All time' },
];

const LINE_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];
const MAX_SELECTED_CATEGORIES = LINE_COLORS.length;

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRange = (key: RangeKey) => {
  if (key === 'all-time') return {};
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (key === 'ytd') start.setMonth(0);
  if (key === '6-months') start.setMonth(now.getMonth() - 5);
  if (key === '12-months') start.setMonth(now.getMonth() - 11);
  if (key === '24-months') start.setMonth(now.getMonth() - 23);
  return { start: formatDate(start), end: formatDate(now) };
};

const getMonthKeys = (
  start?: string,
  end?: string,
  points: AnalyticsCategoryTrendResponse[] = []
) => {
  const pointMonths = points.map((point) => point.month).sort();
  const first = start?.slice(0, 7) ?? pointMonths[0];
  const last = end?.slice(0, 7) ?? pointMonths.at(-1);
  if (!first || !last) return [];

  const [startYear, startMonth] = first.split('-').map(Number);
  const [endYear, endMonth] = last.split('-').map(Number);
  const cursor = new Date(startYear, startMonth - 1, 1);
  const finish = new Date(endYear, endMonth - 1, 1);
  const months: string[] = [];
  while (cursor <= finish) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
};

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(
    new Date(year, monthNumber - 1, 1)
  );
};

export default function TrendsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('12-months');
  const [points, setPoints] = useState<AnalyticsCategoryTrendResponse[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { format, formatConverted, convert } = useCurrency();
  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();
  const range = useMemo(() => getRange(rangeKey), [rangeKey]);

  useEffect(() => {
    if (accountsLoading) return;
    if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
      setPoints([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const accountIds =
      !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined;
    AnalyticsService.getCategoryTrends(range.start, range.end, accountIds)
      .then((result) => {
        if (!cancelled) setPoints(Array.isArray(result) ? result : []);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setPoints([]);
          setError(reason instanceof Error ? reason.message : 'Failed to load spending trends');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    accountsLoading,
    allAccountIds.length,
    isAllAccountsSelected,
    range.end,
    range.start,
    selectedAccountIds,
  ]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of points) {
      totals.set(point.category, (totals.get(point.category) ?? 0) + Number(point.amount));
    }
    return Array.from(totals, ([category, total]) => ({ category, total })).sort(
      (a, b) => b.total - a.total
    );
  }, [points]);

  useEffect(() => {
    if (selectionTouched || categoryTotals.length === 0) return;
    setSelectedCategories(
      categoryTotals.slice(0, MAX_SELECTED_CATEGORIES).map(({ category }) => category)
    );
  }, [categoryTotals, selectionTouched]);

  const monthKeys = useMemo(
    () => getMonthKeys(range.start, range.end, points),
    [points, range.end, range.start]
  );
  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>(
      monthKeys.map((month) => [month, { month, label: formatMonth(month) }])
    );
    for (const category of selectedCategories) {
      for (const row of rows.values()) row[category] = 0;
    }
    for (const point of points) {
      if (!selectedCategories.includes(point.category)) continue;
      const row = rows.get(point.month);
      if (row) row[point.category] = convert(Number(point.amount));
    }
    return Array.from(rows.values());
  }, [convert, monthKeys, points, selectedCategories]);

  const selectedTotal = useMemo(
    () =>
      points
        .filter((point) => selectedCategories.includes(point.category))
        .reduce((sum, point) => sum + Number(point.amount), 0),
    [points, selectedCategories]
  );
  const monthlySelectedTotals = chartData.map((row) =>
    selectedCategories.reduce((sum, category) => sum + Number(row[category] ?? 0), 0)
  );
  const activeMonthCount = monthlySelectedTotals.filter((total) => total > 0).length;
  const latest = monthlySelectedTotals.at(-1) ?? 0;
  const previous = monthlySelectedTotals.at(-2) ?? 0;
  const monthlyChange = previous > 0 ? ((latest - previous) / previous) * 100 : null;
  const peakIndex = monthlySelectedTotals.reduce(
    (best, value, index, values) => (value > values[best] ? index : best),
    0
  );
  const peakLabel = selectedTotal > 0 ? (chartData[peakIndex]?.label ?? 'No data') : 'No data';

  const toggleCategory = (category: string) => {
    setSelectionTouched(true);
    setSelectedCategories((current) => {
      if (current.includes(category)) return current.filter((item) => item !== category);
      if (current.length >= MAX_SELECTED_CATEGORIES) return current;
      return [...current, category];
    });
  };

  return (
    <PageLayout
      badge="Trends"
      title="Spending Trends"
      subtitle="Compare how your spending categories change month by month."
      error={error}
      actions={
        <select
          value={rangeKey}
          onChange={(event) => setRangeKey(event.target.value as RangeKey)}
          className={cn(
            'rounded-full',
            'border',
            'border-slate-200',
            'bg-white/80',
            'px-4',
            'py-2',
            'text-sm',
            'font-medium',
            'dark:border-slate-600',
            'dark:bg-slate-800'
          )}
          aria-label="Trend date range"
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      }
    >
      <div className={cn('grid', 'gap-4', 'sm:grid-cols-2', 'xl:grid-cols-4')}>
        {[
          ['Selected spend', format(selectedTotal)],
          ['Monthly average', format(activeMonthCount ? selectedTotal / activeMonthCount : 0)],
          [
            'Latest vs previous',
            monthlyChange === null
              ? 'No comparison'
              : `${monthlyChange >= 0 ? '+' : ''}${monthlyChange.toFixed(1)}%`,
          ],
          ['Highest month', peakLabel],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <div
              className={cn(
                'text-xs',
                'font-semibold',
                'uppercase',
                'tracking-wider',
                'text-slate-500',
                'dark:text-slate-400'
              )}
            >
              {label}
            </div>
            <div
              className={cn('mt-2', 'text-2xl', 'font-bold', 'text-slate-900', 'dark:text-white')}
            >
              {value}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div
          className={cn(
            'mb-5',
            'flex',
            'flex-col',
            'gap-4',
            'lg:flex-row',
            'lg:items-start',
            'lg:justify-between'
          )}
        >
          <div>
            <h2 className={cn('text-lg', 'font-semibold', 'text-slate-900', 'dark:text-white')}>
              Category comparison
            </h2>
            <p className={cn('mt-1', 'text-sm', 'text-slate-500', 'dark:text-slate-400')}>
              Select up to {MAX_SELECTED_CATEGORIES} categories. The current month may be
              incomplete.
            </p>
          </div>
          <div className={cn('flex', 'gap-2')}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectionTouched(true);
                setSelectedCategories(
                  categoryTotals.slice(0, MAX_SELECTED_CATEGORIES).map(({ category }) => category)
                );
              }}
            >
              Top 6
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectionTouched(true);
                setSelectedCategories([]);
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className={cn('mb-6', 'flex', 'flex-wrap', 'gap-2')}>
          {categoryTotals.map(({ category }) => {
            const selected = selectedCategories.includes(category);
            const disabled = !selected && selectedCategories.length >= MAX_SELECTED_CATEGORIES;
            return (
              <button
                key={category}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => toggleCategory(category)}
                className={cn(
                  'rounded-full',
                  'border',
                  'px-3',
                  'py-1.5',
                  'text-xs',
                  'font-medium',
                  'transition',
                  selected
                    ? 'border-sky-400 bg-sky-100 text-sky-800 dark:border-sky-500 dark:bg-sky-500/20 dark:text-sky-200'
                    : 'border-slate-200 bg-white/70 text-slate-600 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
                  disabled && 'cursor-not-allowed opacity-40'
                )}
              >
                {formatCategoryName(category)}
              </button>
            );
          })}
        </div>

        <div className="h-[440px]">
          {loading ? (
            <div
              className={cn(
                'flex',
                'h-full',
                'items-center',
                'justify-center',
                'text-sm',
                'text-slate-500'
              )}
            >
              Loading trends...
            </div>
          ) : chartData.length === 0 || selectedCategories.length === 0 ? (
            <div
              className={cn(
                'flex',
                'h-full',
                'items-center',
                'justify-center',
                'text-sm',
                'text-slate-500'
              )}
            >
              {categoryTotals.length === 0
                ? 'No spending data is available for this range.'
                : 'Select at least one category to draw the chart.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.22} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat('en-US', {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                />
                <Tooltip formatter={(value) => formatConverted(Number(value))} />
                <Legend formatter={(value) => formatCategoryName(String(value))} />
                {selectedCategories.map((category, index) => (
                  <Line
                    key={category}
                    type="monotone"
                    dataKey={category}
                    stroke={LINE_COLORS[index]}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </PageLayout>
  );
}
