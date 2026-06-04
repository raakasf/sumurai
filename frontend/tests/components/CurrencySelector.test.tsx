import { fireEvent, render, screen } from '@testing-library/react';
import { CurrencySelector } from '@/components/CurrencySelector';
import { useCurrency } from '@/hooks/useCurrency';

jest.mock('@/hooks/useCurrency');

const mockUseCurrency = useCurrency as jest.MockedFunction<typeof useCurrency>;

describe('CurrencySelector', () => {
  const setCurrency = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCurrency.mockReturnValue({
      currency: 'USD',
      rate: 1,
      rateDate: '2026-06-04',
      loading: false,
      error: null,
      setCurrency,
      format: jest.fn(),
      formatConverted: jest.fn(),
      convert: jest.fn(),
      refreshRate: jest.fn(),
    });
  });

  it('changes the display currency through the native select', () => {
    render(<CurrencySelector scrolled={false} />);

    fireEvent.change(screen.getByLabelText('Display currency'), {
      target: { value: 'EUR' },
    });

    expect(setCurrency).toHaveBeenCalledWith('EUR');
    expect(screen.queryByRole('button', { name: 'Open currency options' })).not.toBeInTheDocument();
  });
});
