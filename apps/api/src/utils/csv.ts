import type { Response } from 'express';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(columns: Array<{ key: string; label: string }>, rows: Array<Record<string, unknown>>): string {
  const header = columns.map((column) => escapeCell(column.label)).join(',');
  const lines = rows.map((row) => columns.map((column) => escapeCell(row[column.key])).join(','));
  return [header, ...lines].join('\r\n');
}

export function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
}
