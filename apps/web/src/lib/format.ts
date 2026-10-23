import { formatMinor } from '@lms/shared';

export function money(minor: number | null | undefined, currency = 'PKR'): string {
  return formatMinor(minor ?? 0, currency);
}

export function dateLabel(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function dateTimeLabel(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  }).format(date);
}

export function timeLabel(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  }).format(date);
}

export function weekdayLabel(day: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? '—';
}

export function labelize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function percent(value: number | null | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function localDateInput(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function localDateTimeInput(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function toIsoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/**
 * Session times are entered as institute wall-clock time. Asia/Karachi has a
 * fixed UTC+05:00 offset, so the conversion is deterministic.
 */
export function instituteWallTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:00`).toISOString();
}
