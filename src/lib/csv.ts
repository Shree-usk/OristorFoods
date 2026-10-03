/**
 * STORY-051b's parseSimpleCsv (minimal line/comma parser for the
 * redirect bulk-import — no quoted-field support, URL paths don't
 * contain commas in practice) plus STORY-059b's toCsv, extracted from
 * audit-log-admin.service.ts's original inline CSV builder (STORY-057)
 * — the one place CSV read/write logic lives, reused by every export
 * (audit log, analytics reports) and the redirect import.
 */

export function parseSimpleCsv(text: string): string[][] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = rows.map((row) => row.map((value) => csvEscape(value)).join(","));
  return [headers.map((value) => csvEscape(value)).join(","), ...lines].join("\n");
}
