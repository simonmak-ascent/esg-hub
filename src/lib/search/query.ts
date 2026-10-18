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
 *
 * `string::matches()` is used rather than a match operator: SurrealDB has no
 * `~` operator, and a parse error aborts every statement in the batch.
 */
export function wordBoundaryWhere(column: string, literal: string): string {
  if (!literal) return "false";
  return `string::matches(${column}, '(?i)\\b${literal}\\b')`;
}
