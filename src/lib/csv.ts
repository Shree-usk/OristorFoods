/**
 * STORY-051b. A minimal line/comma parser, not a full RFC4180
 * implementation — deliberate: the only current caller is the redirect
 * bulk-import (sourcePath,destinationPath,statusCode), and URL paths
 * don't contain commas in practice. No quoted-field support. See
 * docs/architecture-decisions.md for the full reasoning.
 */
export function parseSimpleCsv(text: string): string[][] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}
