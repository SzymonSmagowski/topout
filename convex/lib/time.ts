/**
 * Time helpers for window-bounded dashboard queries and weekly reports.
 *
 * All timestamps are epoch milliseconds in UTC. ISO weeks start Monday.
 */
import type { TimeWindow } from './enums';

const ONE_DAY_MS = 86_400_000;

/**
 * Returns the lower-bound timestamp (inclusive) for a dashboard window.
 *
 * `'7d'` → now - 7 days, `'30d'` → now - 30 days, `'90d'` → now - 90 days,
 * `'all'` → `0` (epoch start; everything is included).
 *
 * The choice of "rolling window from now" (not "calendar weeks") matches the
 * spec's UX pill control which doesn't have a calendar picker.
 */
export function windowStart(window: TimeWindow, now: number): number {
  switch (window) {
    case '7d':
      return now - 7 * ONE_DAY_MS;
    case '30d':
      return now - 30 * ONE_DAY_MS;
    case '90d':
      return now - 90 * ONE_DAY_MS;
    case 'all':
      return 0;
  }
}

/**
 * Returns the epoch-millis Monday 00:00 UTC of the ISO week containing `date`.
 * Used to bucket sessions into weekly volume + send-rate-trend charts and to
 * key weekly-report rows.
 *
 * JS `Date.getUTCDay()` is 0 for Sunday … 6 for Saturday, so the offset to the
 * preceding Monday is `(day + 6) % 7`.
 */
export function weekStartFor(date: number): number {
  const d = new Date(date);
  const day = d.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysFromMonday);
}

/** Returns the epoch-millis 00:00 UTC of the calendar day containing `date`. */
export function startOfDayUtc(date: number): number {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
