/**
 * Build a safe, word-boundary literal for tables that have no FULLTEXT index.
 *
 * Such tables fall back to pattern matching. A plain substring match is too
 * loose — `gri` matches `Agricultural` — so the query is reduced to letters,
 * digits, spaces and hyphens and matched with `\b` boundaries. Removing every
 * other character also means the value cannot carry regex metacharacters into
 * the statement.
 */
export function toWordBoundaryLiteral(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[-\s]+|[-\s]+$/g, "");
}

/**
 * SurrealQL predicate for a word-boundary match, or `false` when the query has
 * no matchable characters.
 */
export function wordBoundaryWhere(column: string, literal: string): string {
  if (!literal) return "false";
  return `${column} ~ '(?i)\\b${literal}\\b'`;
}
