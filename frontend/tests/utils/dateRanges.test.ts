import { computeDateRange, computeMonthRange } from '@/utils/dateRanges';

describe('computeDateRange', () => {
  it('computes current month range', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1).toISOString().slice(0, 10);
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const r = computeDateRange('current-month');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it('computes past year range', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m - 11, 1).toISOString().slice(0, 10);
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const r = computeDateRange('past-year');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it('computes all-time limited to five years', () => {
    const r = computeDateRange('all-time');
    expect(r).toEqual({});
  });
});

describe('computeMonthRange', () => {
  it('computes single month range correctly', () => {
    const range = computeMonthRange({ year: 2026, month: 8 }); // September 2026
    expect(range.start).toBe('2026-09-01');
    expect(range.end).toBe('2026-09-30');
  });

  it('computes full year range correctly when month is null', () => {
    const range = computeMonthRange({ year: 2026, month: null });
    expect(range.start).toBe('2026-01-01');
    expect(range.end).toBe('2026-12-31');
  });
});
