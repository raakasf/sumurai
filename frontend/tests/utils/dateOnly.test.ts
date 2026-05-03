import { formatDateOnly, toDateOnlyKey } from '@/utils/dateOnly';

describe('dateOnly utilities', () => {
  it('formats date-only strings without shifting them through UTC', () => {
    expect(formatDateOnly('2026-05-02')).toBe('5/2/2026');
  });

  it('keeps the calendar date from ISO-like backend values', () => {
    expect(toDateOnlyKey('2026-05-02')).toBe('2026-05-02');
    expect(toDateOnlyKey('2026-05-02T00:00:00Z')).toBe('2026-05-02');
  });
});
