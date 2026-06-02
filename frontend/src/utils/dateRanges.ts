export type DateRangeKey =
  | 'current-month'
  | 'past-2-months'
  | 'past-3-months'
  | 'past-6-months'
  | 'past-year'
  | 'all-time';

export type MonthYearSelection = {
  year: number;
  month: number;
};

const fmt = (d: Date) => {
  const year = String(d.getFullYear()).padStart(4, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const localDate = (year: number, month0: number, day: number) => {
  const date = new Date(0);
  date.setFullYear(year, month0, day);
  date.setHours(0, 0, 0, 0);
  return date;
};

export function getCurrentMonthSelection(today = new Date()): MonthYearSelection {
  return {
    year: today.getFullYear(),
    month: today.getMonth(),
  };
}

export function computeMonthRange(selection: MonthYearSelection): { start: string; end: string } {
  const start = localDate(selection.year, selection.month, 1);
  const end = localDate(selection.year, selection.month + 1, 0);
  return { start: fmt(start), end: fmt(end) };
}

export function computeDateRange(key?: DateRangeKey): { start?: string; end?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const firstOfMonth = (year: number, month0: number) => localDate(year, month0, 1);
  const lastOfMonth = (year: number, month0: number) => localDate(year, month0 + 1, 0);

  switch (key) {
    case 'current-month': {
      return { start: fmt(firstOfMonth(y, m)), end: fmt(lastOfMonth(y, m)) };
    }
    case 'past-2-months': {
      const start = firstOfMonth(y, m - 1);
      const end = lastOfMonth(y, m);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'past-3-months': {
      const start = firstOfMonth(y, m - 2);
      const end = lastOfMonth(y, m);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'past-6-months': {
      const start = firstOfMonth(y, m - 5);
      const end = lastOfMonth(y, m);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'past-year': {
      const start = firstOfMonth(y, m - 11);
      const end = lastOfMonth(y, m);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'all-time': {
      return {};
    }
    default:
      return {};
  }
}
