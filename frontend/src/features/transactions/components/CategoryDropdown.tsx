import { AdjustmentsHorizontalIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/primitives';
import { ConflictError } from '../../../services/ApiClient';
import type { UserCategory } from '../../../types/api';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';

type OverrideType = 'none' | 'rule' | 'explicit';

interface CategoryDropdownProps {
  currentCategory: string;
  overrideType: OverrideType;
  merchantName?: string;
  userCategories: UserCategory[];
  onSelect: (categoryName: string) => Promise<void>;
  onReset: () => Promise<void>;
  onCreateAndSelect: (name: string) => Promise<void>;
  onCreateRule: (pattern: string, categoryName: string) => Promise<void>;
}

const BUILT_IN_CATEGORIES = [
  'FOOD_AND_DRINK',
  'SHOPPING',
  'TRAVEL',
  'ENTERTAINMENT',
  'GENERAL_MERCHANDISE',
  'GENERAL_SERVICES',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'INCOME',
  'RENT_AND_UTILITIES',
  'HEALTHCARE',
  'PERSONAL_CARE',
  'EDUCATION',
  'OTHER',
];

// Trim the trailing numeric/date tokens from a merchant name and append *
// so the pattern matches all transactions from the same merchant family.
// e.g. "MD DIR ACH CONTRIB 040926 000029739552008 486 A6068227701" → "MD DIR ACH CONTRIB*"
// e.g. "STARBUCKS #1234" → "STARBUCKS*"
function suggestPattern(name: string): string {
  const tokens = name.trim().split(/\s+/);
  const cut = tokens.findIndex((t) => /^\d{4,}/.test(t) || /^#?\d{3,}/.test(t));
  const prefix = cut > 0 ? tokens.slice(0, cut).join(' ') : name;
  return prefix.trimEnd() + '*';
}

export const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  currentCategory,
  overrideType,
  merchantName,
  userCategories,
  onSelect,
  onReset,
  onCreateAndSelect,
  onCreateRule,
}) => {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleCategory, setRuleCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('[data-category-dropdown]')
      ) {
        setOpen(false);
        setCreating(false);
        setCreatingRule(false);
        setNewName('');
        setRulePattern('');
        setRuleCategory('');
        setError(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = useCallback(
    async (name: string) => {
      setSaving(true);
      setError(null);
      try {
        await onSelect(name);
        setOpen(false);
      } catch {
        setError('Failed to update category.');
      } finally {
        setSaving(false);
      }
    },
    [onSelect]
  );

  const handleReset = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await onReset();
      setOpen(false);
    } catch {
      setError('Failed to reset category.');
    } finally {
      setSaving(false);
    }
  }, [onReset]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = newName.trim();
      if (!name) return;
      setSaving(true);
      setError(null);
      try {
        await onCreateAndSelect(name);
        setNewName('');
        setCreating(false);
        setOpen(false);
      } catch (err: unknown) {
        const msg = err instanceof ConflictError
          ? 'A category with that name already exists.'
          : 'Failed to create category.';
        setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [newName, onCreateAndSelect]
  );

  const handleCreateRule = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const pattern = rulePattern.trim();
      const category = ruleCategory.trim();
      if (!pattern || !category) return;
      setSaving(true);
      setError(null);
      try {
        await onCreateRule(pattern, category);
        setRulePattern('');
        setRuleCategory('');
        setCreatingRule(false);
        setOpen(false);
      } catch {
        setError('Failed to create rule.');
      } finally {
        setSaving(false);
      }
    },
    [rulePattern, ruleCategory, onCreateRule]
  );

  const openRuleForm = useCallback(() => {
    setCreatingRule(true);
    setCreating(false);
    setRulePattern(suggestPattern(merchantName ?? ''));
    setRuleCategory(currentCategory);
    setError(null);
  }, [merchantName, currentCategory]);

  const catName = formatCategoryName(currentCategory);
  const theme = getTagThemeForCategory(catName);

  const builtInOptions = BUILT_IN_CATEGORIES.map((c) => ({
    value: c,
    label: formatCategoryName(c),
  }));

  const customOptions = userCategories.map((uc) => ({
    value: uc.name,
    label: uc.name,
  }));

  const dropdown = (
    <AnimatePresence>
      {open && (
        <motion.div
          data-category-dropdown
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.13 }}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
          className={cn(
            'min-w-[200px] max-w-xs overflow-hidden rounded-xl',
            'border border-slate-200/80 bg-white shadow-xl',
            'dark:border-slate-700/80 dark:bg-slate-800'
          )}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {overrideType !== 'none' && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs',
                  'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50'
                )}
              >
                <XMarkIcon className="h-3.5 w-3.5 shrink-0" />
                Reset to original
              </button>
            )}

            {customOptions.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  My categories
                </div>
                {customOptions.map((opt) => {
                  const t = getTagThemeForCategory(opt.label);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={saving}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                        'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50',
                        currentCategory === opt.value && 'font-semibold'
                      )}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
                      {opt.label}
                    </button>
                  );
                })}
              </>
            )}

            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Categories
            </div>
            {builtInOptions.map((opt) => {
              const t = getTagThemeForCategory(opt.label);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={saving}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                    'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50',
                    currentCategory === opt.value && 'font-semibold'
                  )}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-200/80 p-2 dark:border-slate-700/80">
            {error && (
              <p className="mb-1.5 px-1 text-[11px] text-red-500">{error}</p>
            )}

            {creatingRule ? (
              <form onSubmit={handleCreateRule} className="flex flex-col gap-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  New auto-rule
                </p>
                <input
                  autoFocus
                  value={rulePattern}
                  onChange={(e) => setRulePattern(e.target.value)}
                  placeholder="Glob pattern (e.g. *AMAZON*)"
                  maxLength={200}
                  className={cn(
                    'min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1',
                    'text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none',
                    'focus:ring-2 focus:ring-sky-400/60',
                    'dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                  )}
                />
                <input
                  value={ruleCategory}
                  onChange={(e) => setRuleCategory(e.target.value)}
                  placeholder="Category name"
                  maxLength={80}
                  className={cn(
                    'min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1',
                    'text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none',
                    'focus:ring-2 focus:ring-sky-400/60',
                    'dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                  )}
                />
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={saving || !rulePattern.trim() || !ruleCategory.trim()}
                    className={cn(
                      'flex-1 rounded-lg bg-violet-500 px-2 py-1 text-xs font-medium text-white',
                      'transition hover:bg-violet-600 disabled:opacity-50'
                    )}
                  >
                    {saving ? '…' : 'Save rule'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingRule(false);
                      setRulePattern('');
                      setRuleCategory('');
                      setError(null);
                    }}
                    className="rounded-lg px-1.5 py-1 text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            ) : creating ? (
              <form onSubmit={handleCreate} className="flex gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New category…"
                  maxLength={80}
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1',
                    'text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none',
                    'focus:ring-2 focus:ring-sky-400/60',
                    'dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                  )}
                />
                <button
                  type="submit"
                  disabled={saving || !newName.trim()}
                  className={cn(
                    'rounded-lg bg-sky-500 px-2 py-1 text-xs font-medium text-white',
                    'transition hover:bg-sky-600 disabled:opacity-50'
                  )}
                >
                  {saving ? '…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName('');
                    setError(null);
                  }}
                  className="rounded-lg px-1.5 py-1 text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs',
                    'text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/30'
                  )}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  New category
                </button>
                <button
                  type="button"
                  onClick={openRuleForm}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs',
                    'text-violet-600 transition hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/30'
                  )}
                >
                  <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
                  Auto-rule for this merchant
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Change category: ${catName}`}
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
        className={cn(
          'group/cat inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-all duration-200',
          'backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
          'hover:ring-2 hover:ring-sky-400/60 dark:hover:ring-sky-400/50 cursor-pointer',
          theme.tag
        )}
      >
        <span
          className={`h-2 w-2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)] ${theme.dot}`}
          aria-hidden="true"
        />
        <span className="max-w-[120px] truncate">{catName}</span>
        {overrideType === 'rule' && (
          <span title="Auto-rule applied" className="ml-0.5 opacity-60">
            <AdjustmentsHorizontalIcon className="h-2.5 w-2.5" />
          </span>
        )}
        {overrideType === 'explicit' && (
          <span title="Manually set" className="ml-0.5 text-[9px] font-semibold opacity-60">
            ✎
          </span>
        )}
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </>
  );
};

export default CategoryDropdown;
