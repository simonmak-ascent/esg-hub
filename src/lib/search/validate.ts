/**
 * Validation helpers for search request input.
 *
 * Every value interpolated into a SurrealQL statement must be a number or pass
 * through `sanitize()`. These helpers are the single place where vector search
 * input is coerced, so a caller cannot smuggle a statement separator through a
 * numeric parameter.
 */

export const EMBEDDING_DIMENSIONS = 384;

/**
 * Coerce a request-supplied KNN result count into a safe integer.
 * Non-numeric, negative, zero, and non-finite values fall back to the default.
 */
export function clampResultCount(value: unknown, fallback = 10, max = 50): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

/**
 * Validate a request-supplied embedding vector.
 * Returns the vector, or `null` when it is not an array of finite numbers.
 */
export function parseEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 4096) {
    return null;
  }

  const vector: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) {
      return null;
    }
    vector.push(entry);
  }

  return vector;
}

/**
 * Validate a `source` filter against the values the query builder understands.
 */
export function parseSource(value: unknown): "all" | "pages" | "external" {
  return value === "pages" || value === "external" ? value : "all";
}
