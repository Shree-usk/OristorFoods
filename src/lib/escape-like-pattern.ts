/**
 * Prisma's `contains` becomes ILIKE, where `%` and `_` are wildcards and `\`
 * is the escape character. Escape all three so user search words match
 * literally. Shared by the Q&A and recipe search filters.
 */
export function escapeLikePattern(word: string): string {
  return word.replace(/[\\%_]/g, (character) => `\\${character}`);
}
