import { addDaysUTC, toIsoUTC, truncateToUTC } from './holidays';

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // dom(0) ou sáb(6)
}

export function listYearsBetween(start: Date, end: Date): number[] {
  const years: number[] = [];
  const s = start.getUTCFullYear();
  const e = end.getUTCFullYear();
  for (let y = s; y <= e; y++) years.push(y);
  return years;
}

export function countBusinessDaysInclusive(
  start: Date,
  end: Date,
  isHoliday: (isoDate: string) => boolean
): number {
  let s = truncateToUTC(start);
  let e = truncateToUTC(end);
  if (e < s) return 0;

  let count = 0;
  for (let d = s; d <= e; d = addDaysUTC(d, 1)) {
    if (isWeekend(d)) continue;
    const iso = toIsoUTC(d);
    if (isHoliday(iso)) continue;
    count += 1;
  }
  return count;
}


