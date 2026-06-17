export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
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
