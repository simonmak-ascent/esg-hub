/**
 * Build a safe, word-boundary literal for tables that have no FULLTEXT index.
 *
 * Such tables fall back to matching. A plain substring match is too loose —
 * `gri` matches `Agricultural` — so the query is reduced to letters, digits,
 * spaces and hyphens. Removing every other character also means the value
 * cannot carry regex or SurrealQL metacharacters into the statement.
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
 * Both sides are padded with spaces and compared with `CONTAINS`, which needs
 * no escape sequences. Regex boundaries were tried first: `\b` is consumed as
 * a backspace escape by SurrealDB string literals, and a malformed pattern
 * aborts every statement in the batch. `column` is an internal constant, never
 * request input; `literal` is reduced to letters/digits/space/hyphen above.
 */
export function wordBoundaryWhere(column: string, literal: string): string {
  if (!literal) return "false";
  return `(' ' + string::lowercase(${column}) + ' ') CONTAINS ' ${literal} '`;
}
