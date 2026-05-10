interface NetWorthPoint {
  date: string;
  value: number;
}

interface ChargeTransaction {
  account_id?: string;
  account_type?: string;
  amount: number;
  date: string;
  merchant?: string;
  name?: string;
}

export interface UpcomingChargePrediction {
  merchant: string;
  amount: number;
  nextDate: string;
  daysUntil: number;
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  confidence: 'high' | 'medium';
  occurrenceCount: number;
}

interface ChargeGroup {
  merchant: string;
  transactions: ChargeTransaction[];
}

interface CadenceMatch {
  cadence: UpcomingChargePrediction['cadence'];
  days: number;
  score: number;
}

export class DashboardCalculator {
  static calculateNetYAxisDomain(series: NetWorthPoint[]): [number, number] | null {
    if (!series || series.length === 0) return null;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const point of series) {
      const value = Number(point?.value);
      if (!Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

    if (min === max) {
      const padding = Math.max(Math.abs(max) * 0.1, 500);
      return [max - padding, max + padding];
    }

    const span = Math.abs(max - min);
    const padding = Math.max(span * 0.08, 500);
    return [min - padding, max + padding];
  }

  static calculateNetDotIndices(series: NetWorthPoint[]): Set<number> {
    const selected = new Set<number>();
    const n = series?.length || 0;

    if (!n) return selected;

    const changeIdx: number[] = [];
    for (let i = 1; i < n; i++) {
      const prev = Number(series[i - 1]?.value ?? 0);
      const curr = Number(series[i]?.value ?? 0);
      if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
      if (curr !== prev) changeIdx.push(i);
    }

    const maxDots = 30;
    if (changeIdx.length > 0) {
      const stride = Math.max(1, Math.ceil(changeIdx.length / maxDots));
      for (let k = 0; k < changeIdx.length; k += stride) selected.add(changeIdx[k]);
      selected.add(changeIdx[changeIdx.length - 1]);
    }

    return selected;
  }

  static predictUpcomingCharges(
    transactions: ChargeTransaction[],
    today = new Date(),
    horizonDays = 45
  ): UpcomingChargePrediction[] {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];

    const groups = DashboardCalculator.groupChargeTransactions(transactions);
    const todayKey = DashboardCalculator.toDateKey(today);
    const horizon = DashboardCalculator.addDays(todayKey, horizonDays);
    const predictions: UpcomingChargePrediction[] = [];

    for (const group of groups.values()) {
      const sorted = group.transactions
        .filter((transaction) => DashboardCalculator.toDateKey(transaction.date))
        .sort((a, b) =>
          DashboardCalculator.toDateKey(a.date).localeCompare(DashboardCalculator.toDateKey(b.date))
        );

      if (sorted.length < 2) continue;

      const intervals = DashboardCalculator.getIntervals(sorted);
      if (intervals.length === 0) continue;

      const medianInterval = DashboardCalculator.median(intervals);
      const cadence = DashboardCalculator.matchCadence(medianInterval);
      if (!cadence) continue;

      const stableIntervals = intervals.filter(
        (interval) => Math.abs(interval - cadence.days) <= Math.max(2, cadence.days * 0.18)
      );
      if (stableIntervals.length === 0) continue;

      const amounts = sorted.map((transaction) =>
        Math.abs(DashboardCalculator.getDisplayAmount(transaction))
      );
      const predictedAmount = DashboardCalculator.median(amounts.slice(-4));
      if (!Number.isFinite(predictedAmount) || predictedAmount < 1) continue;

      const latest = sorted[sorted.length - 1];
      let nextDate =
        cadence.cadence === 'monthly'
          ? DashboardCalculator.addMonthsClamped(DashboardCalculator.toDateKey(latest.date), 1)
          : DashboardCalculator.addDays(DashboardCalculator.toDateKey(latest.date), cadence.days);

      while (nextDate <= todayKey) {
        nextDate =
          cadence.cadence === 'monthly'
            ? DashboardCalculator.addMonthsClamped(nextDate, 1)
            : DashboardCalculator.addDays(nextDate, cadence.days);
      }

      if (nextDate > horizon) continue;

      const daysUntil = DashboardCalculator.daysBetween(todayKey, nextDate);
      const recentAmounts = amounts.slice(-4);
      const averageRecentAmount =
        recentAmounts.reduce((sum, amount) => sum + amount, 0) / recentAmounts.length;
      const amountDrift =
        averageRecentAmount > 0
          ? Math.max(...recentAmounts.map((amount) => Math.abs(amount - averageRecentAmount))) /
            averageRecentAmount
          : 0;
      const confidence =
        sorted.length >= 3 &&
        stableIntervals.length >= Math.max(1, intervals.length - 1) &&
        amountDrift <= 0.2
          ? 'high'
          : 'medium';

      predictions.push({
        merchant: group.merchant,
        amount: predictedAmount,
        nextDate,
        daysUntil,
        cadence: cadence.cadence,
        confidence,
        occurrenceCount: sorted.length,
      });
    }

    return predictions.sort((a, b) => a.daysUntil - b.daysUntil || b.amount - a.amount).slice(0, 8);
  }

  private static groupChargeTransactions(
    transactions: ChargeTransaction[]
  ): Map<string, ChargeGroup> {
    const groups = new Map<string, ChargeGroup>();

    for (const transaction of transactions) {
      const displayAmount = DashboardCalculator.getDisplayAmount(transaction);
      if (!Number.isFinite(displayAmount) || displayAmount >= 0) continue;

      const merchant = DashboardCalculator.normalizeMerchant(
        transaction.merchant || transaction.name || ''
      );
      if (!merchant) continue;

      const key = `${merchant}:${transaction.account_id || 'all'}`;
      const existing = groups.get(key);
      if (existing) {
        existing.transactions.push(transaction);
      } else {
        groups.set(key, {
          merchant,
          transactions: [transaction],
        });
      }
    }

    return groups;
  }

  private static normalizeMerchant(value: string): string {
    return value
      .replace(/\s+/g, ' ')
      .replace(/\s+\d{2,}.*$/, '')
      .trim();
  }

  private static getDisplayAmount(transaction: ChargeTransaction): number {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount)) return 0;
    const accountType = transaction.account_type?.toLowerCase() ?? '';
    const isCreditAccount = accountType === 'credit' || accountType === 'credit card';
    return isCreditAccount ? amount : -amount;
  }

  private static getIntervals(transactions: ChargeTransaction[]): number[] {
    const intervals: number[] = [];

    for (let i = 1; i < transactions.length; i++) {
      const previous = DashboardCalculator.toDateKey(transactions[i - 1].date);
      const current = DashboardCalculator.toDateKey(transactions[i].date);
      const diff = DashboardCalculator.daysBetween(previous, current);
      if (diff > 0) intervals.push(diff);
    }

    return intervals;
  }

  private static matchCadence(days: number): CadenceMatch | null {
    const cadences: Array<Omit<CadenceMatch, 'score'>> = [
      { cadence: 'weekly', days: 7 },
      { cadence: 'biweekly', days: 14 },
      { cadence: 'monthly', days: 30 },
      { cadence: 'quarterly', days: 91 },
      { cadence: 'yearly', days: 365 },
    ];

    const matches = cadences
      .map((cadence) => ({
        ...cadence,
        score: Math.abs(days - cadence.days),
      }))
      .filter((cadence) => cadence.score <= Math.max(2, cadence.days * 0.12))
      .sort((a, b) => a.score - b.score);

    return matches[0] ?? null;
  }

  private static median(values: number[]): number {
    const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (finiteValues.length === 0) return 0;

    const middle = Math.floor(finiteValues.length / 2);
    if (finiteValues.length % 2 === 1) return finiteValues[middle];

    return (finiteValues[middle - 1] + finiteValues[middle]) / 2;
  }

  private static toDateKey(value: Date | string): string {
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) return '';
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
        value.getDate()
      ).padStart(2, '0')}`;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;

    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return '';
    return DashboardCalculator.toDateKey(parsed);
  }

  private static fromDateKey(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private static daysBetween(start: string, end: string): number {
    const startDate = DashboardCalculator.fromDateKey(start);
    const endDate = DashboardCalculator.fromDateKey(end);
    return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
  }

  private static addDays(value: string, days: number): string {
    const date = DashboardCalculator.fromDateKey(value);
    date.setDate(date.getDate() + days);
    return DashboardCalculator.toDateKey(date);
  }

  private static addMonthsClamped(value: string, months: number): string {
    const date = DashboardCalculator.fromDateKey(value);
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDay));
    return DashboardCalculator.toDateKey(date);
  }
}
