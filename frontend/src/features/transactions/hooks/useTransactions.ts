import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type FilterCriteria, TransactionFilter } from '../../../domain/TransactionFilter';
import { useAccountFilter } from '../../../hooks/useAccountFilter';
import { CategoryService } from '../../../services/CategoryService';
import { type TransactionFilters, TransactionService } from '../../../services/TransactionService';
import type { Transaction, UserCategory } from '../../../types/api';
import { formatCategoryName } from '../../../utils/categories';

export type DateRangeKey = string | undefined;

export interface UseTransactionsOptions {
  initialSearch?: string;
  initialCategory?: string | null;
  initialDateRange?: DateRangeKey;
  pageSize?: number;
}

export interface UseTransactionsResult {
  isLoading: boolean;
  error: string | null;
  transactions: Transaction[];
  categories: string[];
  search: string;
  setSearch: (s: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  dateRange: DateRangeKey;
  setDateRange: (r: DateRangeKey) => void;
  // pagination
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageItems: Transaction[];
  totalItems: number;
  totalPages: number;
  // category management
  userCategories: UserCategory[];
  updateTransactionCategory: (transactionId: string, categoryName: string) => Promise<void>;
  resetTransactionCategory: (transactionId: string) => Promise<void>;
  createCategoryAndAssign: (transactionId: string, name: string) => Promise<void>;
  createCategoryRule: (transactionId: string, pattern: string, categoryName: string) => Promise<void>;
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsResult {
  const { initialSearch = '', initialCategory = null, initialDateRange, pageSize = 10 } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState<Transaction[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [dateRange, setDateRange] = useState<DateRangeKey>(initialDateRange);
  const [currentPage, setCurrentPage] = useState(1);
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);

  const {
    selectedAccountIds,
    isAllAccountsSelected,
    allAccountIds,
    loading: accountsLoading,
  } = useAccountFilter();

  const load = useCallback(async () => {
    if (accountsLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const filters: TransactionFilters = {};
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        setAll([]);
        return;
      }
      if (dateRange) filters.dateRange = String(dateRange);
      if (!isAllAccountsSelected && selectedAccountIds.length > 0) {
        filters.accountIds = selectedAccountIds;
      }
      const txns = await TransactionService.getTransactions(filters);
      setAll(txns);
    } catch (error: unknown) {
      const status = getStatus(error);
      const msg =
        status === 401
          ? 'You are not authenticated. Please log in again.'
          : 'Failed to load transactions.';
      setError(msg);
      setAll([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountsLoading, dateRange, isAllAccountsSelected, selectedAccountIds, allAccountIds]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    CategoryService.getCategories()
      .then(setUserCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, []);

  const updateTransactionCategory = useCallback(
    async (transactionId: string, categoryName: string) => {
      await CategoryService.setTransactionCategory(transactionId, categoryName);
      setAll((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? { ...t, custom_category: categoryName, category: { ...t.category, primary: categoryName } }
            : t
        )
      );
    },
    []
  );

  const resetTransactionCategory = useCallback(async (transactionId: string) => {
    await CategoryService.removeTransactionCategory(transactionId);
    // Reload to get original provider category
    await load();
  }, [load]);

  const createCategoryAndAssign = useCallback(
    async (transactionId: string, name: string) => {
      const created = await CategoryService.createCategory(name);
      setUserCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      await CategoryService.setTransactionCategory(transactionId, name);
      setAll((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? { ...t, custom_category: name, category: { ...t.category, primary: name } }
            : t
        )
      );
    },
    []
  );

  const createCategoryRule = useCallback(
    async (transactionId: string, pattern: string, categoryName: string) => {
      await CategoryService.createRule(pattern, categoryName);
      // Reload so glob matching is re-applied server-side for all transactions
      await load();
    },
    [load]
  );

  const debouncedSearch = useDebounce(search, 300);

  const resolveCategoryLabel = useCallback((t: Transaction) => {
    if (!t.category) {
      return 'Uncategorized';
    }
    return formatCategoryName(t.category.primary);
  }, []);

  const filtered = useMemo(() => {
    const criteria: FilterCriteria = {
      search: debouncedSearch.trim(),
      category: selectedCategory || undefined,
    };
    return TransactionFilter.filter(all, criteria);
  }, [all, debouncedSearch, selectedCategory]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const t of filtered) {
      const name = resolveCategoryLabel(t) || 'Uncategorized';
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [filtered, resolveCategoryLabel]);

  useEffect(() => {
    if (selectedCategory && !categories.includes(selectedCategory)) {
      setSelectedCategory(null);
    }
  }, [categories, selectedCategory]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (currentPage - 1) * pageSize;
  const pageItems = useMemo(() => {
    return filtered.slice(start, start + pageSize);
  }, [filtered, start, pageSize]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: specific filters should reset pagination
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, debouncedSearch, dateRange, selectedAccountIds]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return {
    isLoading,
    error,
    transactions: filtered,
    categories,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    dateRange,
    setDateRange,
    currentPage,
    setCurrentPage,
    pageItems,
    totalItems,
    totalPages,
    userCategories,
    updateTransactionCategory,
    resetTransactionCategory,
    createCategoryAndAssign,
    createCategoryRule,
  };
}

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setV(value), delay);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, delay]);
  return v;
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}
