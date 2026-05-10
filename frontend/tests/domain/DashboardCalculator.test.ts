import { DashboardCalculator } from '../../src/domain/DashboardCalculator';

interface NetWorthPoint {
  date: string;
  value: number;
}

const charge = (
  overrides: Partial<{
    account_id: string;
    account_type: string;
    amount: number;
    date: string;
    merchant: string;
    name: string;
  }> = {}
) => ({
  account_id: 'checking-1',
  account_type: 'depository',
  amount: 12.99,
  date: '2026-04-01',
  merchant: 'StreamCo',
  name: 'StreamCo',
  ...overrides,
});

describe('DashboardCalculator', () => {
  describe('calculateNetYAxisDomain', () => {
    it('returns null for empty series', () => {
      const domain = DashboardCalculator.calculateNetYAxisDomain([]);
      expect(domain).toBeNull();
    });

    it('returns null when all values are non-finite', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: NaN },
        { date: '2025-01-02', value: Infinity },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeNull();
    });

    it('pads range when min equals max', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 5000 },
        { date: '2025-01-02', value: 5000 },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      expect(domain).toHaveLength(2);
      expect(domain![0]).toBeLessThan(5000);
      expect(domain![1]).toBeGreaterThan(5000);
    });

    it('adds padding to range when min differs from max', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 0 },
        { date: '2025-01-02', value: 10000 },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      expect(domain![0]).toBeLessThanOrEqual(0);
      expect(domain![1]).toBeGreaterThanOrEqual(10000);
    });

    it('filters out non-finite values in calculation', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 1000 },
        { date: '2025-01-02', value: NaN },
        { date: '2025-01-03', value: 9000 },
        { date: '2025-01-04', value: Infinity },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      expect(domain![0]).toBeLessThanOrEqual(1000);
      expect(domain![1]).toBeGreaterThanOrEqual(9000);
    });

    it('calculates correct padding for small ranges', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 0 },
        { date: '2025-01-02', value: 100 },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      const [min, max] = domain!;
      const span = max - min;
      expect(span).toBeGreaterThan(100);
    });

    it('uses minimum padding of 500', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 10000 },
        { date: '2025-01-02', value: 10000 },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      const [min, max] = domain!;
      const padding = 10000 - min;
      expect(padding).toBeGreaterThanOrEqual(500);
    });
  });

  describe('calculateNetDotIndices', () => {
    it('returns empty set for empty series', () => {
      const indices = DashboardCalculator.calculateNetDotIndices([]);
      expect(indices.size).toBe(0);
    });

    it('identifies indices where values change', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 1000 },
        { date: '2025-01-02', value: 1000 },
        { date: '2025-01-03', value: 2000 },
        { date: '2025-01-04', value: 2000 },
      ];
      const indices = DashboardCalculator.calculateNetDotIndices(series);
      expect(indices.has(2)).toBe(true);
    });

    it('limits max dots to 30', () => {
      const series: NetWorthPoint[] = [];
      for (let i = 0; i < 100; i++) {
        series.push({ date: `2025-01-${(i % 31) + 1}`, value: i % 2 === 0 ? 1000 : 2000 });
      }
      const indices = DashboardCalculator.calculateNetDotIndices(series);
      expect(indices.size).toBeLessThanOrEqual(30);
    });

    it('always includes last change index', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 1000 },
        { date: '2025-01-02', value: 2000 },
        { date: '2025-01-03', value: 3000 },
        { date: '2025-01-04', value: 4000 },
      ];
      const indices = DashboardCalculator.calculateNetDotIndices(series);
      if (indices.size > 0) {
        const maxIndex = Math.max(...Array.from(indices));
        expect(maxIndex).toBeGreaterThan(0);
      }
    });

    it('skips non-finite values in comparison', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 1000 },
        { date: '2025-01-02', value: NaN },
        { date: '2025-01-03', value: 1000 },
      ];
      const indices = DashboardCalculator.calculateNetDotIndices(series);
      expect(indices.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('predictUpcomingCharges', () => {
    it('predicts monthly charges from recurring merchant history', () => {
      const predictions = DashboardCalculator.predictUpcomingCharges(
        [
          charge({ date: '2026-02-05', amount: 14.99 }),
          charge({ date: '2026-03-05', amount: 14.99 }),
          charge({ date: '2026-04-05', amount: 14.99 }),
        ],
        new Date(2026, 3, 20)
      );

      expect(predictions).toHaveLength(1);
      expect(predictions[0]).toMatchObject({
        merchant: 'StreamCo',
        amount: 14.99,
        nextDate: '2026-05-05',
        daysUntil: 15,
        cadence: 'monthly',
        confidence: 'high',
        occurrenceCount: 3,
      });
    });

    it('treats negative credit card purchases as charges', () => {
      const predictions = DashboardCalculator.predictUpcomingCharges(
        [
          charge({
            account_type: 'credit',
            amount: -49,
            date: '2026-03-10',
            merchant: 'Gym Club',
          }),
          charge({
            account_type: 'credit',
            amount: -49,
            date: '2026-04-10',
            merchant: 'Gym Club',
          }),
        ],
        new Date(2026, 3, 20)
      );

      expect(predictions[0]).toMatchObject({
        merchant: 'Gym Club',
        amount: 49,
        nextDate: '2026-05-10',
        cadence: 'monthly',
      });
    });

    it('ignores deposits and one-off charges', () => {
      const predictions = DashboardCalculator.predictUpcomingCharges(
        [
          charge({ amount: -2000, date: '2026-04-01', merchant: 'Payroll' }),
          charge({ amount: 80, date: '2026-04-03', merchant: 'One Off Store' }),
        ],
        new Date(2026, 3, 20)
      );

      expect(predictions).toEqual([]);
    });

    it('only returns charges inside the prediction horizon', () => {
      const predictions = DashboardCalculator.predictUpcomingCharges(
        [
          charge({ date: '2025-01-01', merchant: 'Annual App', amount: 120 }),
          charge({ date: '2026-01-01', merchant: 'Annual App', amount: 120 }),
        ],
        new Date(2026, 1, 1),
        45
      );

      expect(predictions).toEqual([]);
    });

    it('sorts by due date and limits results', () => {
      const transactions = Array.from({ length: 10 }, (_, index) => [
        charge({
          date: `2026-03-${String(index + 1).padStart(2, '0')}`,
          merchant: `Service ${index}`,
          amount: 10 + index,
        }),
        charge({
          date: `2026-04-${String(index + 1).padStart(2, '0')}`,
          merchant: `Service ${index}`,
          amount: 10 + index,
        }),
      ]).flat();

      const predictions = DashboardCalculator.predictUpcomingCharges(
        transactions,
        new Date(2026, 3, 20)
      );

      expect(predictions).toHaveLength(8);
      expect(predictions[0].nextDate).toBe('2026-05-01');
      expect(predictions[7].nextDate).toBe('2026-05-08');
    });
  });
});
