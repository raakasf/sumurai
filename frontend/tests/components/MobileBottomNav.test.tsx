import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MobileBottomNav } from '@/components/MobileBottomNav';

describe('MobileBottomNav', () => {
  it('renders all 5 navigation tabs on mobile', () => {
    render(<MobileBottomNav currentTab="dashboard" onTabChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Mobile Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mobile Trends' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mobile Transactions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mobile Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mobile Settings' })).toBeInTheDocument();
  });

  it('marks the active tab with aria-current="page"', () => {
    render(<MobileBottomNav currentTab="transactions" onTabChange={() => {}} />);

    const transactionsBtn = screen.getByRole('button', { name: 'Mobile Transactions' });
    const dashboardBtn = screen.getByRole('button', { name: 'Mobile Dashboard' });

    expect(transactionsBtn).toHaveAttribute('aria-current', 'page');
    expect(dashboardBtn).not.toHaveAttribute('aria-current');
  });

  it('calls onTabChange when a tab is tapped', () => {
    const handleTabChange = jest.fn();
    render(<MobileBottomNav currentTab="dashboard" onTabChange={handleTabChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mobile Trends' }));
    expect(handleTabChange).toHaveBeenCalledWith('trends');

    fireEvent.click(screen.getByRole('button', { name: 'Mobile Accounts' }));
    expect(handleTabChange).toHaveBeenCalledWith('accounts');
  });

  it('displays issue badge on settings tab when issuesCount > 0', () => {
    const { rerender } = render(
      <MobileBottomNav currentTab="dashboard" onTabChange={() => {}} issuesCount={0} />
    );

    expect(screen.queryByTestId('mobile-account-issues-badge')).not.toBeInTheDocument();

    rerender(
      <MobileBottomNav currentTab="dashboard" onTabChange={() => {}} issuesCount={3} />
    );

    const badge = screen.getByTestId('mobile-account-issues-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');
  });
});

