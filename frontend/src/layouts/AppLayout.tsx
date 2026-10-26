import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import { CurrencySelector } from '../components/CurrencySelector';
import { HeaderAccountFilter } from '../components/HeaderAccountFilter';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { useTheme } from '../context/ThemeContext';
import { useAccountIssues } from '../hooks/useAccountIssues';
import { useScrollDetection } from '../hooks/useScrollDetection';
import { AppFooter, AppTitleBar } from '../ui/primitives';

type TabKey = 'dashboard' | 'trends' | 'transactions' | 'accounts' | 'settings';

interface AppLayoutProps {
  children: ReactNode;
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
  className?: string;
}

export function AppLayout({
  children,
  currentTab,
  onTabChange,
  onLogout,
  className,
}: AppLayoutProps) {
  const scrolled = useScrollDetection();
  const { mode, toggle } = useTheme();
  const { issues: accountIssues } = useAccountIssues();

  const isSelectorVisible =
    currentTab === 'dashboard' || currentTab === 'transactions' || currentTab === 'trends';

  return (
    <div className={className}>
      <div className={cn('relative', 'z-10', 'flex', 'min-h-[100dvh]', 'flex-col')}>
        <AppTitleBar
          state="authenticated"
          scrolled={scrolled}
          themeMode={mode}
          onThemeToggle={toggle}
          onLogout={onLogout}
          currentTab={currentTab}
          onTabChange={onTabChange}
          accountIssues={accountIssues}
          accountFilterNode={
            <div className={cn('flex', 'items-center', 'gap-1.5 sm:gap-2')}>
              <HeaderAccountFilter scrolled={scrolled} />
              <CurrencySelector scrolled={scrolled} />
            </div>
          }
        />

        <main
          className={cn(
            'flex-1 px-3.5 sm:px-6 lg:px-12 py-3 sm:py-6 lg:py-8',
            isSelectorVisible ? 'pb-36 md:pb-28' : 'pb-24 md:pb-8'
          )}
        >
          {children}
        </main>

        <AppFooter />

        <MobileBottomNav
          currentTab={currentTab}
          onTabChange={onTabChange}
          issuesCount={accountIssues?.length}
        />
      </div>
    </div>
  );
}

export default AppLayout;
