/**
 * CJK query handling.
 *
 * SurrealDB's full-text analyzer for this corpus is ASCII/English
 * (`FILTERS lowercase, ascii, snowball(english)`), so Chinese text is not
 * tokenized. Substring matching works, but only when the whole query appears
 * verbatim — a question such as "什么是双重重要性？" never does.
 *
 * These helpers reduce a natural-language question to short Han terms
 * (bigrams/trigrams) and build an OR predicate over the translated columns.
 * Recall is the goal: ranking happens afterwards.
 */

const STOP_PHRASES = [
  "请问",
  "什么是",
  "是什么",
  "为什么",
  "怎么样",
  "怎样",
  "如何",
  "哪些",
  "什么",
  "是否",
  "介绍",
  "一下",
  "可以",
  "以及",
  "关于",
  "我们",
];

/**
 * Extract 2–3 character Han terms from a query. Latin words are kept whole.
 */
export function cjkTerms(query: string, max = 8): string[] {
  let normalized = query
    .toLowerCase()
    .replace(/[^\p{Script=Han}\p{L}\p{N}]+/gu, " ");

  for (const stop of STOP_PHRASES) {
    normalized = normalized.split(stop).join(" ");
  }

  const runs = normalized.split(/\s+/).filter(Boolean);
  const terms: string[] = [];

  for (const run of runs) {
    // Latin words are already tokens: keep them whole. Only Han runs need
    // n-grams, because there are no spaces to split on.
    if (!/\p{Script=Han}/u.test(run) || run.length <= 3) {
      terms.push(run);
      continue;
    }
    for (let i = 0; i + 2 <= run.length; i++) terms.push(run.slice(i, i + 2));
    for (let i = 0; i + 3 <= run.length; i++) terms.push(run.slice(i, i + 3));
  }

  return [...new Set(terms)].sort((a, b) => b.length - a.length).slice(0, max);
}

/**
 * OR predicate matching any term in any of the given columns, or `false` when
 * there is nothing to match. Terms are reduced to Han/Latin/digits above, so
 * they cannot carry quotes or statement separators.
 */
export function cjkContainsWhere(columns: string[], terms: string[]): string {
  if (terms.length === 0) return "false";
  return terms
    .flatMap((term) => columns.map((column) => `${column} CONTAINS '${term}'`))
    .join(" OR ");
}

/**
 * Relevance for a CJK page: a title match outranks a body-only match.
 */
export function cjkRelevance(title: string | null | undefined, terms: string[]): number {
  if (!title) return 1;
  return terms.some((term) => title.includes(term)) ? 10 : 1;
}
