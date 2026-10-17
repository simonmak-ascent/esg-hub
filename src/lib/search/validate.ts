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
 * Returns `null` when the value is present but not an integer in range, so the
 * caller can reject it instead of silently substituting a default.
 */
export function parseResultCount(value: unknown, fallback = 10, max = 50): number | null {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    return null;
  }
  return value;
}

/**
 * Validate a request-supplied embedding vector.
 * Returns the vector, or `null` when it is not an array of finite numbers of
 * the expected dimensionality.
 */
export function parseEmbedding(
  value: unknown,
  dimensions = EMBEDDING_DIMENSIONS
): number[] | null {
  if (!Array.isArray(value) || value.length !== dimensions) {
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
