export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;

export type RatingLabel = (typeof RATINGS)[number];

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Due date N calendar days from `from` (midnight local on the target day). */
export function addCalendarDays(from: Date, days: number): Date {
  const d = startOfDay(from);
  d.setDate(d.getDate() + Math.round(days));
  return d;
}

export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / (24 * 60 * 60 * 1000),
  );
}

const MINUTES_PER_DAY = 24 * 60;

/** Sub-day delays use minutes; 1+ day delays snap to calendar dates. */
export function scheduleDelayFromNow(now: Date, minutes: number): Date {
  if (minutes >= MINUTES_PER_DAY) {
    return addCalendarDays(now, minutes / MINUTES_PER_DAY);
  }
  return addMinutes(now, minutes);
}

/** Review intervals of 1+ days schedule to a calendar date, not +24h from now. */
export function scheduleReviewDue(now: Date, intervalDays: number): Date {
  return addCalendarDays(now, intervalDays);
}

export function daysBetween(from: Date, to: Date): number {
  return calendarDaysBetween(from, to);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatIntervalLabel(minutes: number, days: number): string {
  if (minutes > 0 && days < 1) {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  }
  if (days < 1) return '<1d';
  if (days < 30) return `${Math.round(days)}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.round(days / 365);
  return `${years}y`;
}

export function minutesToDays(minutes: number): number {
  return minutes / (24 * 60);
}

/** Compact Anki-style interval shown on rating buttons (estimate on top). */
export function formatAnkiRatingButtonLabel(
  _rating: RatingLabel,
  dueAt: Date,
  now: Date = new Date(),
): string {
  if (Number.isNaN(dueAt.getTime())) return '—';

  const calDays = calendarDaysBetween(now, dueAt);
  if (calDays >= 1) {
    if (calDays < 30) return `${calDays}d`;
    const months = Math.round(calDays / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.round(calDays / 365)}y`;
  }

  const ms = Math.max(0, dueAt.getTime() - now.getTime());
  const minutes = ms / (60 * 1000);

  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

/** Human-readable label for when a card is next due (from now). */
export function formatNextReviewLabel(dueAt: Date, now: Date = new Date()): string {
  const calDays = calendarDaysBetween(now, dueAt);
  if (calDays >= 1) {
    if (calDays < 30) return `${calDays}d`;
    const months = Math.round(calDays / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.round(calDays / 365)}y`;
  }

  const ms = dueAt.getTime() - now.getTime();
  if (ms < 60 * 1000) return '<1m';

  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 60) return `${minutes}m`;

  return '1d';
}

export function formatDueAt(dueAt: Date, now: Date = new Date()): string {
  if (dueAt.getTime() <= now.getTime()) return 'now';

  const calDays = calendarDaysBetween(now, dueAt);
  if (calDays >= 1) {
    if (calDays === 1) return 'tomorrow';
    if (calDays < 30) return `in ${calDays}d`;
    if (calDays < 365) {
      return dueAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return dueAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const minutes = Math.max(1, Math.round((dueAt.getTime() - now.getTime()) / (60 * 1000)));
  if (minutes < 60) return `in ${minutes}m`;
  return 'later today';
}
