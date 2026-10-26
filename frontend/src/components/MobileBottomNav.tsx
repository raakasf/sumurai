import { Landmark, LayoutDashboard, ReceiptText, Settings, TrendingUp } from 'lucide-react';
import type React from 'react';
import { cn } from '@/ui/primitives';

export type TabKey = 'dashboard' | 'trends' | 'transactions' | 'accounts' | 'settings';

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'transactions', label: 'Transactions', icon: ReceiptText },
  { key: 'accounts', label: 'Accounts', icon: Landmark },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export interface MobileBottomNavProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  issuesCount?: number;
}

export function MobileBottomNav({
  currentTab,
  onTabChange,
  issuesCount = 0,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile Navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'md:hidden',
        'border-t border-slate-200/80 dark:border-slate-800/80',
        'bg-white/95 dark:bg-slate-900/95',
        'backdrop-blur-md',
        'shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.12)] dark:shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.6)]',
        'pb-[env(safe-area-inset-bottom,0px)]'
      )}
    >
      <div className="flex h-16 items-center justify-around px-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = currentTab === key;
          const hasIssues = key === 'settings' && issuesCount > 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={cn(
                'group relative flex flex-1 flex-col items-center justify-center py-2 px-1 min-w-0 transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-xl active:scale-95',
                isActive
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              )}
              aria-label={`Mobile ${label}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-sky-500 dark:bg-sky-400"
                  aria-hidden="true"
                />
              )}
              <div className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    isActive && 'scale-110'
                  )}
                />
                {hasIssues && (
                  <span
                    data-testid="mobile-account-issues-badge"
                    className="absolute -top-1 -right-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-slate-900 animate-pulse"
                  >
                    {issuesCount}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'mt-1 text-[10px] tracking-tight truncate max-w-full transition-all',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
