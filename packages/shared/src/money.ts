/**
 * Money helpers. All amounts are integer minor units (paisa for PKR).
 * Parsing is string-based so no binary floating point ever participates.
 */
export const ZERO_MINOR = 0;

export function formatMinor(minor: number, currency = 'PKR', locale = 'en-PK'): string {
  const safe = Number.isFinite(minor) ? Math.trunc(minor) : 0;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safe) / 100);
  return `${safe < 0 ? '-' : ''}${currency} ${formatted}`;
}

/** Parses a decimal string or number into minor units, rounding half-up to 2 decimals. */
export function toMinorUnits(value: string | number): number | null {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (raw === '' || !/^\d+(\.\d{1,6})?$/.test(raw)) return null;
  const [wholePart, fractionPart = ''] = raw.split('.');
  const whole = Number(wholePart);
  if (!Number.isSafeInteger(whole)) return null;
  const padded = `${fractionPart}000`;
  const paisa = Number(padded.slice(0, 2));
  const remainder = padded.slice(2);
  const roundUp = remainder.length > 0 && Number(remainder[0]) >= 5;
  const minor = whole * 100 + paisa + (roundUp ? 1 : 0);
  return Number.isSafeInteger(minor) ? minor : null;
}

export function minorToDecimalString(minor: number): string {
  const safe = Math.trunc(Math.abs(minor));
  return `${minor < 0 ? '-' : ''}${Math.floor(safe / 100)}.${String(safe % 100).padStart(2, '0')}`;
}
