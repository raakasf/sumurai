const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function toDateOnlyKey(value: string): string {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateOnly(value: string, locale = 'en-US'): string {
  const key = toDateOnlyKey(value);
  const match = DATE_ONLY_PATTERN.exec(key);
  if (!match) return value;

  const [, year, month, day] = match;
  return new Intl.DateTimeFormat(locale).format(
    new Date(Number(year), Number(month) - 1, Number(day))
  );
}
